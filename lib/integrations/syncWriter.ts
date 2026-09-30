// Writing a sync run to Firestore: backup → guarded write → read-back check,
// with automatic restore if anything goes wrong, plus the daily snapshot, the
// run log for admins and the short status everyone sees.
//
// Collections (written only by the service account; see firestore.rules):
//   masterData/chunk_###            the dashboard data, 250 rows per document
//   masterDataBackups/{run}         backup manifest; {run}__{chunk} hold copies
//   snapshots/{date}__{nn}          daily numbers of changed posts
//   syncRuns/{run}                  full report of each run (admins, 90 days)
//   syncStatus/latest               short status for every signed-in user
import { decodeFields, docId, encodeFields, encodeValue, type Firestore, type RawDoc } from "./firestoreRest.ts";
import { chunkSnapshot, rowKey, type SnapshotRow } from "./metricoolSync.ts";

type Row = Record<string, unknown>;

export const CHUNK_ROWS = 250;
export const KEEP_BACKUPS = 7;
export const KEEP_RUN_DAYS = 90;
export const KEEP_SNAPSHOT_DAYS = 365;

export const runIdFor = (d = new Date()) => d.toISOString().slice(0, 19).replace(/:/g, "-") + "Z";

export async function backupMasterData(db: Firestore, docs: RawDoc[], runId: string): Promise<number> {
  const takenAt = new Date().toISOString();
  for (const d of docs) {
    await db.set(`masterDataBackups/${runId}__${docId(d.name)}`, {
      runId: encodeValue(runId),
      source: encodeValue(docId(d.name)),
      data: { mapValue: { fields: d.fields || {} } },
    });
  }
  await db.set(`masterDataBackups/${runId}`, encodeFields({
    runId,
    takenAt,
    manifest: true,
    documents: docs.map((d) => docId(d.name)),
  }));
  return docs.length;
}

/** Put masterData back exactly as it was in backup `runId`. */
export async function restoreMasterData(db: Firestore, runId: string): Promise<number> {
  const all = await db.listRaw("masterDataBackups");
  const copies = all.filter((d) => docId(d.name).startsWith(`${runId}__`));
  if (!copies.length) throw new Error(`no backup ${runId}`);
  const keep = new Set<string>();
  for (const c of copies) {
    const source = String(c.fields.source?.stringValue || "");
    const data = (c.fields.data as { mapValue?: { fields?: RawDoc["fields"] } })?.mapValue?.fields || {};
    await db.set(`masterData/${source}`, data);
    keep.add(source);
  }
  for (const d of await db.listRaw("masterData")) if (!keep.has(docId(d.name))) await db.delete(`masterData/${docId(d.name)}`);
  return copies.length;
}

/**
 * Replace masterData with `rows`, only if no document changed since it was
 * read (`readDocs`). Existing chunks beyond the new count are emptied, the
 * same way the dashboard's own "บันทึกขึ้น Cloud" does it.
 */
export async function writeMasterData(db: Firestore, rows: Row[], readDocs: RawDoc[]): Promise<number> {
  const current = await db.listRaw("masterData");
  const readAt = new Map(readDocs.map((d) => [docId(d.name), d.updateTime]));
  const changed = current.filter((d) => readAt.get(docId(d.name)) !== d.updateTime).map((d) => docId(d.name));
  const added = current.filter((d) => !readAt.has(docId(d.name))).map((d) => docId(d.name));
  if (changed.length || added.length) {
    throw new Error(`masterData changed while syncing (${[...changed, ...added].slice(0, 5).join(", ")}); nothing written`);
  }
  const now = new Date().toISOString();
  const total = Math.ceil(rows.length / CHUNK_ROWS);
  const byId = new Map(current.map((d) => [docId(d.name), d]));
  for (let i = 0; i < total; i++) {
    const id = `chunk_${String(i).padStart(3, "0")}`;
    const chunk = rows.slice(i * CHUNK_ROWS, (i + 1) * CHUNK_ROWS);
    await db.set(
      `masterData/${id}`,
      encodeFields({ chunkIndex: i, rowCount: chunk.length, updatedAt: now, rows: chunk }),
      byId.has(id) ? { updateTime: byId.get(id)?.updateTime } : { mustNotExist: true },
    );
    byId.delete(id);
  }
  for (const [id, d] of byId) {
    await db.set(`masterData/${id}`, encodeFields({ chunkIndex: -1, rowCount: 0, updatedAt: now, rows: [] }), { updateTime: d.updateTime });
  }
  return total;
}

/**
 * Today's snapshot. A second run on the same day merges into it (newer numbers
 * win per post) so the morning's rows are kept; earlier days are never touched.
 */
export async function writeSnapshot(db: Firestore, date: string, runId: string, rows: SnapshotRow[]): Promise<number> {
  const existing = (await db.listRaw("snapshots")).filter((d) => docId(d.name).startsWith(`${date}__`));
  const byKey = new Map<string, SnapshotRow>();
  for (const d of existing) {
    const data = decodeFields(d.fields || {});
    for (const r of (data.rows as SnapshotRow[]) || []) byKey.set(r.k, r);
  }
  for (const r of rows) byKey.set(r.k, r);
  const chunks = chunkSnapshot([...byKey.values()]);
  for (let i = 0; i < chunks.length; i++) {
    await db.set(`snapshots/${date}__${String(i).padStart(2, "0")}`, encodeFields({ date, runId, part: i, rowCount: chunks[i].length, rows: chunks[i] }));
  }
  // Fewer parts than before (should not happen when merging): drop the extra ones.
  for (const d of existing) if (Number(docId(d.name).split("__")[1]) >= chunks.length) await db.delete(`snapshots/${docId(d.name)}`);
  return chunks.length;
}

export interface PlatformStatus {
  ok: boolean;
  latestPost: string;
  error?: string;
}

export interface RunReport {
  runId: string;
  status: "success" | "blocked" | "failed";
  trigger: "schedule" | "manual" | "local";
  startedAt: string;
  finishedAt: string;
  window: { since: string; until: string };
  message: string;
  platforms: Record<string, PlatformStatus>;
  sources: Record<string, unknown>[];
  totals: Record<string, number>;
  checks: { name: string; pass: boolean; detail: string; warnings?: string[] }[];
  backupId?: string;
  snapshotDocs?: number;
  githubRunUrl?: string;
}

/** Full report for admins, and the short status every signed-in user reads. */
export async function writeRunReport(db: Firestore, report: RunReport): Promise<void> {
  await db.set(`syncRuns/${report.runId}`, encodeFields(report as unknown as Row));
  const latest: Row = {
    runId: report.runId,
    status: report.status,
    finishedAt: report.finishedAt,
    message: report.message,
    platforms: report.platforms,
  };
  // Keep the last good time so "ข้อมูลอัปเดตล่าสุด" does not jump backwards on a failed run.
  const previous = await db.get("syncStatus/latest");
  const prevSuccess = String(previous?.fields?.lastSuccessAt?.stringValue || "");
  latest.lastSuccessAt = report.status === "success" ? report.finishedAt : prevSuccess;
  await db.set("syncStatus/latest", encodeFields(latest));
}

/** Drop run logs after 90 days, snapshots after a year, backups beyond the last 7. */
export async function cleanupOld(db: Firestore, now = new Date()): Promise<Record<string, number>> {
  const cutoff = (days: number) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const removed = { syncRuns: 0, snapshots: 0, backups: 0 };
  for (const d of await db.listRaw("syncRuns")) {
    if (docId(d.name).slice(0, 10) < cutoff(KEEP_RUN_DAYS)) { await db.delete(`syncRuns/${docId(d.name)}`); removed.syncRuns++; }
  }
  for (const d of await db.listRaw("snapshots")) {
    if (docId(d.name).slice(0, 10) < cutoff(KEEP_SNAPSHOT_DAYS)) { await db.delete(`snapshots/${docId(d.name)}`); removed.snapshots++; }
  }
  const backups = await db.listRaw("masterDataBackups");
  const runs = [...new Set(backups.map((d) => docId(d.name).split("__")[0]))].sort();
  const drop = new Set(runs.slice(0, Math.max(0, runs.length - KEEP_BACKUPS)));
  for (const d of backups) {
    if (drop.has(docId(d.name).split("__")[0])) { await db.delete(`masterDataBackups/${docId(d.name)}`); removed.backups++; }
  }
  return removed;
}

/** Read masterData back and confirm it holds exactly the rows written. */
export async function verifyMasterData(db: Firestore, expected: Row[]): Promise<string> {
  const docs = await db.listRaw("masterData");
  let count = 0;
  const keys = new Set<string>();
  for (const d of docs) {
    const values = (d.fields.rows as { arrayValue?: { values?: unknown[] } })?.arrayValue?.values || [];
    count += values.length;
  }
  for (const r of expected) { const k = rowKey(r); if (k) keys.add(k); }
  return count === expected.length ? "" : `read back ${count} rows, expected ${expected.length}`;
}
