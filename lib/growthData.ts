// Reads growthDaily/{day} (see lib/dashboard/growth.ts) for the growth page.
import { Bytes, collection, doc, documentId, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GrowthEntry } from "@/lib/dashboard/growth";
import { runIdTime } from "@/lib/dashboard/earlySignal";

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

// A day is filed once the next morning's sync has run; later runs on that
// same morning may add to it. Older days do not change, so keep them for the session.
const settled = new Map<string, GrowthEntry[] | null>();
/** When each loaded day's numbers were taken: its last sync run (ms). */
const syncTimes = new Map<string, number>();

/** Sync time of every day loaded so far (for start speed: views ÷ hours since posting). */
export const growthSyncTimes = (): Map<string, number> => new Map(syncTimes);
const bangkokToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

async function loadDay(day: string): Promise<GrowthEntry[] | null> {
  if (settled.has(day)) return settled.get(day)!;
  const snap = await getDoc(doc(db, "growthDaily", day));
  const data = snap.exists() ? snap.data() : null;
  const runs = Array.isArray(data?.runIds) ? (data.runIds as string[]) : [];
  const taken = runs.length ? runIdTime(runs[runs.length - 1]) : null;
  if (taken) syncTimes.set(day, taken);
  const entries = data?.data ? (JSON.parse(await gunzip((data.data as Bytes).toUint8Array())) as GrowthEntry[]) : null;
  // Missing today/yesterday may still arrive with the next sync: do not keep "no data" for them.
  const yesterday = new Date(Date.parse(`${bangkokToday()}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  if (day < yesterday) settled.set(day, entries);
  return entries;
}

/** Each day's entries, or null for a day without data. Six reads at a time. */
export async function loadGrowthDays(days: string[]): Promise<Map<string, GrowthEntry[] | null>> {
  const out = new Map<string, GrowthEntry[] | null>();
  const queue = [...days];
  await Promise.all(
    Array.from({ length: Math.min(6, queue.length) }, async () => {
      for (let day = queue.shift(); day; day = queue.shift()) out.set(day, await loadDay(day));
    }),
  );
  return out;
}

/** The first day that has growth data (one small query), or "" if none yet. */
export async function firstGrowthDay(): Promise<string> {
  const snap = await getDocs(query(collection(db, "growthDaily"), orderBy(documentId()), limit(1)));
  return snap.docs[0]?.id || "";
}
