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
// Spark plan: 1 GB of storage. Longer history lives in the daily local backup
// (scripts/backup-local.mjs), so Firestore keeps only what a rollback needs.
export const KEEP_BACKUPS = 3;
export const KEEP_RUN_DAYS = 90;
export const KEEP_SNAPSHOT_DAYS = 60;

export const runIdFor = (d = new Date()) => d.toISOString().slice(0, 19).replace(/:/g, "-") + "Z";

/** Documents written at once: backup and masterData took ~10 min each one by one. */
export const PARALLEL_WRITES = 4;

/**
 * `fn` over every item, `limit` at a time. Stops taking new items after a
 * failure and waits for the ones in flight, so nothing is still writing when
 * the caller restores the backup; then throws the first error.
 */
export async function eachLimited<T>(items: T[], fn: (item: T) => Promise<unknown>, limit = PARALLEL_WRITES): Promise<void> {
  let next = 0;
  let failed: unknown = null;
  const worker = async () => {
    while (failed === null && next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (e) {
        if (failed === null) failed = e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed !== null) throw failed;
}

export async function backupMasterData(db: Firestore, docs: RawDoc[], runId: string): Promise<number> {
  const takenAt = new Date().toISOString();
  await eachLimited(docs, (d) =>
    db.set(`masterDataBackups/${runId}__${docId(d.name)}`, {
      runId: encodeValue(runId),
      source: encodeValue(docId(d.name)),
      data: { mapValue: { fields: d.fields || {} } },
    }),
  );
  // The manifest last: a backup without one was cut off and is never used (cleanupOld drops it).
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
  // Only this run's copies are downloaded, not every backup.
  const copies: RawDoc[] = [];
  for (const id of (await db.listNames("masterDataBackups")).filter((n) => n.startsWith(`${runId}__`))) {
    const d = await db.get(`masterDataBackups/${id}`);
    if (d) copies.push(d);
  }
  if (!copies.length) throw new Error(`no backup ${runId}`);
  const keep = new Set<string>();
  for (const c of copies) {
    const source = String(c.fields.source?.stringValue || "");
    const data = (c.fields.data as { mapValue?: { fields?: RawDoc["fields"] } })?.mapValue?.fields || {};
    await db.set(`masterData/${source}`, data);
    keep.add(source);
  }
  for (const id of await db.listNames("masterData")) if (!keep.has(id)) await db.delete(`masterData/${id}`);
  return copies.length;
}

/**
 * Replace masterData with `rows`, only if no document changed since it was
 * read (`readDocs`). Existing chunks beyond the new count are emptied, the
 * same way the dashboard's own "บันทึกขึ้น Cloud" does it.
 */
export async function writeMasterData(db: Firestore, rows: Row[], readDocs: RawDoc[]): Promise<number> {
  // Update times only: the documents themselves were read for the baseline.
  const current = await db.listStamps("masterData");
  const readAt = new Map(readDocs.map((d) => [docId(d.name), d.updateTime]));
  const changed = current.filter((d) => readAt.get(docId(d.name)) !== d.updateTime).map((d) => docId(d.name));
  const added = current.filter((d) => !readAt.has(docId(d.name))).map((d) => docId(d.name));
  if (changed.length || added.length) {
    throw new Error(`masterData changed while syncing (${[...changed, ...added].slice(0, 5).join(", ")}); nothing written`);
  }
  const now = new Date().toISOString();
  const total = Math.ceil(rows.length / CHUNK_ROWS);
  // Only data chunks; other documents (masterData/meta) are not rows.
  const byId = new Map(current.filter((d) => docId(d.name).startsWith("chunk_")).map((d) => [docId(d.name), d]));
  const writes: { id: string; fields: Record<string, unknown>; pre: { updateTime?: string; mustNotExist?: boolean } }[] = [];
  for (let i = 0; i < total; i++) {
    const id = `chunk_${String(i).padStart(3, "0")}`;
    const chunk = rows.slice(i * CHUNK_ROWS, (i + 1) * CHUNK_ROWS);
    writes.push({
      id,
      fields: { chunkIndex: i, rowCount: chunk.length, updatedAt: now, rows: chunk },
      pre: byId.has(id) ? { updateTime: byId.get(id)?.updateTime } : { mustNotExist: true },
    });
    byId.delete(id);
  }
  for (const [id, d] of byId) writes.push({ id, fields: { chunkIndex: -1, rowCount: 0, updatedAt: now, rows: [] }, pre: { updateTime: d.updateTime } });
  await eachLimited(writes, (w) => db.set(`masterData/${w.id}`, encodeFields(w.fields), w.pre));
  return total;
}

/**
 * Today's snapshot. A second run on the same day merges into it (newer numbers
 * win per post) so the morning's rows are kept; earlier days are never touched.
 */
export async function writeSnapshot(db: Firestore, date: string, runId: string, rows: SnapshotRow[]): Promise<number> {
  // Names first, then only today's parts: the other days are never downloaded.
  const existing: RawDoc[] = [];
  for (const id of (await db.listNames("snapshots")).filter((n) => n.startsWith(`${date}__`))) {
    const d = await db.get(`snapshots/${id}`);
    if (d) existing.push(d);
  }
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

export interface TvSourceStatus {
  id: string;
  name: string;
  ok: boolean;
  episodes?: number;
  pending?: number;
  cancelled?: number;
  competitors?: number;
  error?: string;
  from?: string;
  /** Rows read with a correction or left out, for a person to check. */
  problems?: string[];
}

/** An optional data source beside the platforms (e.g. YouTube Analytics): never fails the run. */
export interface IntegrationStatus {
  ok: boolean;
  detail: string;
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
  tvSources?: TvSourceStatus[];
  /** TV this run: air days of new episodes, episodes updated, latest air day with a rating. */
  tv?: { inserted: string[]; updated: number; latest: string; named?: { date: string; program: string; topic: string; clips: string }[] };
  integrations?: Record<string, IntegrationStatus>;
  notify?: { ok: boolean; at: string; to: number; error?: string };
  totals: Record<string, number>;
  checks: { name: string; pass: boolean; detail: string; warnings?: string[] }[];
  backupId?: string;
  snapshotDocs?: number;
  githubRunUrl?: string;
  /** Seconds per step (scripts/metricool-sync.mjs mark()). */
  timings?: { step: string; sec: number }[];
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
    tvSources: report.tvSources || [],
    integrations: report.integrations || {},
    ...(report.notify ? { notify: report.notify } : {}),
  };
  // Keep the last good time so "ข้อมูลอัปเดตล่าสุด" does not jump backwards on a failed run.
  const previous = await db.get("syncStatus/latest");
  const prevSuccess = String(previous?.fields?.lastSuccessAt?.stringValue || "");
  latest.lastSuccessAt = report.status === "success" ? report.finishedAt : prevSuccess;
  await db.set("syncStatus/latest", encodeFields(latest));
}

/**
 * Drop run logs after 90 days, snapshots after 60 days and sync backups beyond
 * the last 3. Named backups (e.g. "topic-fix-…", made by hand before a data
 * fix) are never removed here. Reads names only, never the documents.
 */
export async function cleanupOld(
  db: Firestore,
  now = new Date(),
  keep: { backups: number; snapshotDays: number } = { backups: KEEP_BACKUPS, snapshotDays: KEEP_SNAPSHOT_DAYS },
): Promise<Record<string, number>> {
  const cutoff = (days: number) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const removed = { syncRuns: 0, snapshots: 0, backups: 0 };
  for (const id of await db.listNames("syncRuns")) {
    if (id.slice(0, 10) < cutoff(KEEP_RUN_DAYS)) { await db.delete(`syncRuns/${id}`); removed.syncRuns++; }
  }
  for (const id of await db.listNames("snapshots")) {
    if (id.slice(0, 10) < cutoff(keep.snapshotDays)) { await db.delete(`snapshots/${id}`); removed.snapshots++; }
  }
  const backups = await db.listNames("masterDataBackups");
  // Sync backups are named by their run time ("2026-10-06T…"); others are kept.
  // One without its manifest was cut off midway: it is dropped and does not count
  // as one of the backups kept.
  const runs = [...new Set(backups.map((id) => id.split("__")[0]))].filter((r) => /^\d{4}-\d{2}-\d{2}T/.test(r)).sort();
  const complete = runs.filter((r) => backups.includes(r));
  const drop = new Set([...runs.filter((r) => !backups.includes(r)), ...complete.slice(0, Math.max(0, complete.length - keep.backups))]);
  for (const id of backups) {
    if (drop.has(id.split("__")[0])) { await db.delete(`masterDataBackups/${id}`); removed.backups++; }
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
