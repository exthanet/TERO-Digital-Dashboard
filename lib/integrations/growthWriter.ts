// The sync's side of daily growth (see lib/dashboard/growth.ts):
// growthDaily/{day} = { day, syncDates, runIds, rowCount, late, totals, data }
// where data is the gzipped JSON of GrowthEntry[]. Written after masterData
// is written and verified; a second run on the same day adds to it.
import { gunzipSync, gzipSync } from "node:zlib";
import { addDays, mergeGrowth, type GrowthEntry } from "../dashboard/growth.ts";
import { parseNumber } from "./metricool.ts";
import { rowKey, type MergeResult } from "./metricoolSync.ts";
import { decodeFields, encodeFields, type Firestore } from "./firestoreRest.ts";

/** Firestore documents hold at most 1 MiB. */
const MAX_BYTES = 900_000;

/** Gains filed under the day before the sync day: the views happened then. */
export const growthDayFor = (syncDay: string) => addDays(syncDay, -1);

const isoDay = (v: unknown) => String(v ?? "").slice(0, 10);

/** Each updated post's change, and new posts counted from 0. */
export function buildGrowth(result: Pick<MergeResult, "updated" | "inserted">, day: string): { entries: GrowthEntry[]; late: number } {
  const entries: GrowthEntry[] = [];
  for (const u of result.updated) {
    const diff = (col: "Views" | "Likes" | "Comments" | "Shares") =>
      col in u.after ? parseNumber(u.after[col]) - parseNumber(u.before[col]) : 0;
    const e: GrowthEntry = [u.key, diff("Views"), diff("Likes"), diff("Comments"), diff("Shares"), 0];
    if (e[1] || e[2] || e[3] || e[4]) entries.push(e);
  }
  let late = 0;
  const earliest = addDays(day, -1);
  for (const r of result.inserted) {
    const key = rowKey(r);
    if (!key) continue;
    if (isoDay(r.Date) < earliest) {
      late++;
      continue;
    }
    entries.push([key, parseNumber(r.Views), parseNumber(r.Likes), parseNumber(r.Comments), parseNumber(r.Shares), 1]);
  }
  return { entries, late };
}

function totalsByPlatform(entries: GrowthEntry[]) {
  const totals: Record<string, { views: number; engagement: number; posts: number }> = {};
  for (const [key, v, l, c, s] of entries) {
    const p = key.split("|")[0];
    const t = (totals[p] ||= { views: 0, engagement: 0, posts: 0 });
    t.views += v;
    t.engagement += l + c + s;
    t.posts++;
  }
  return totals;
}

export async function writeGrowth(
  db: Firestore,
  day: string,
  syncDay: string,
  runId: string,
  growth: { entries: GrowthEntry[]; late: number },
): Promise<{ rows: number; bytes: number }> {
  const path = `growthDaily/${day}`;
  const existing = await db.get(path);
  let entries = growth.entries;
  let late = growth.late;
  let syncDates = [syncDay];
  let runIds = [runId];
  if (existing) {
    const old = decodeFields(existing.fields || {});
    const bytes = existing.fields?.data && "bytesValue" in existing.fields.data ? String(existing.fields.data.bytesValue) : "";
    const before = bytes ? (JSON.parse(gunzipSync(Buffer.from(bytes, "base64")).toString("utf8")) as GrowthEntry[]) : [];
    entries = mergeGrowth(before, entries);
    late += Number(old.late || 0);
    syncDates = [...new Set([...((old.syncDates as string[]) || []), syncDay])];
    runIds = [...((old.runIds as string[]) || []), runId];
  }
  const data = gzipSync(JSON.stringify(entries), { level: 9 });
  if (data.length > MAX_BYTES) throw new Error(`growth for ${day} is ${data.length} bytes, over the document limit`);
  await db.set(path, {
    ...encodeFields({ day, syncDates, runIds, rowCount: entries.length, late, totals: totalsByPlatform(entries), updatedAt: new Date().toISOString() }),
    data: { bytesValue: data.toString("base64") },
  });
  return { rows: entries.length, bytes: data.length };
}
