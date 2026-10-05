// Advanced → การเติบโต → "คลิปใหม่ที่เริ่มต้นแรง": how fast a new clip started,
// against clips of the same programme, platform and format measured the same way.
//
// A new post's first growth entry holds the views it had when the morning sync
// first saw it. Divided by the hours from posting to that sync, clips posted
// late at night and early in the morning compare fairly. Raw numbers only.
//
// "แมส" (later): in the top 10% of its group within 7 days. Its odds need a few
// weeks of history first, so this file only ranks the start.
//
// Relative imports only: tests run this file directly with Node.
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import type { RecordRow } from "./types.ts";

/** Fewer clips than this in a group: "ข้อมูลยังน้อย". */
export const MIN_PEERS = 20;
/** New clips = posted within this many days of the latest growth day. */
export const NEW_DAYS = 3;
/** Measurements outside this window (hours after posting) are not comparable. */
const MIN_HOURS = 0.5;
const MAX_HOURS = 48;

export type EarlyLevel = "hot" | "good" | "normal" | "few" | "none";

export interface EarlyClip {
  key: string;
  row: RecordRow;
  /** Views when the sync first saw the post. */
  firstViews: number;
  comments: number;
  shares: number;
  /** Hours from posting to that sync; null without a posting time. */
  hours: number | null;
  perHour: number | null;
  /** Share of the group's clips that started slower (0–1); null when not measurable. */
  percentile: number | null;
  peers: number;
  level: EarlyLevel;
}

/** "2026-10-02T09-03-37Z" (sync run id) → ms. */
export const runIdTime = (id: string): number | null => {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/);
  const t = m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Bangkok posting time → ms; null without a time. */
export const postedAt = (r: RecordRow): number | null => {
  const m = r.publishTime.match(/^(\d{1,2}):(\d{2})/);
  if (!m || !r.date) return null;
  const t = Date.parse(`${r.date}T${m[1].padStart(2, "0")}:${m[2]}:00+07:00`);
  return Number.isFinite(t) ? t : null;
};

const groupOf = (r: RecordRow) => `${r.program}|${r.platform}|${r.vdoType}`;

/**
 * Every post whose first appearance is in `days`, with its start speed and
 * rank in its group. `syncTimes`: when each day's numbers were taken (ms).
 */
export function earlySignals(
  days: Map<string, GrowthEntry[] | null>,
  syncTimes: Map<string, number>,
  rows: RecordRow[],
): EarlyClip[] {
  const byKey = new Map<string, RecordRow>();
  for (const r of rows) {
    if (r.platform === "TV") continue;
    const k = recordKey(r);
    if (k && !byKey.has(k)) byKey.set(k, r);
  }
  const seen = new Set<string>();
  const clips: EarlyClip[] = [];
  for (const day of [...days.keys()].sort()) {
    for (const [key, views, , comments, shares, isNew] of days.get(day) || []) {
      if (!isNew || seen.has(key)) continue;
      seen.add(key);
      const row = byKey.get(key);
      if (!row) continue;
      const posted = postedAt(row);
      const taken = syncTimes.get(day);
      const h = posted !== null && taken ? (taken - posted) / 3600000 : null;
      const hours = h !== null && h >= MIN_HOURS && h <= MAX_HOURS ? h : null;
      clips.push({
        key,
        row,
        firstViews: views,
        comments,
        shares,
        hours,
        perHour: hours ? views / hours : null,
        percentile: null,
        peers: 0,
        level: "none",
      });
    }
  }

  const groups = new Map<string, number[]>();
  for (const c of clips) if (c.perHour !== null) groups.set(groupOf(c.row), [...(groups.get(groupOf(c.row)) || []), c.perHour]);
  for (const c of clips) {
    if (c.perHour === null) continue;
    const list = groups.get(groupOf(c.row)) || [];
    c.peers = list.length - 1;
    if (c.peers < MIN_PEERS) {
      c.level = "few";
      continue;
    }
    c.percentile = list.filter((v) => v < c.perHour!).length / c.peers;
    c.level = c.percentile >= 0.9 ? "hot" : c.percentile >= 0.75 ? "good" : "normal";
  }
  return clips;
}

/**
 * Clips posted in the last few days (counting back from `latestDay`, the newest
 * growth day; a post from the sync morning itself is filed under the day before),
 * fastest start first; unmeasurable ones last.
 */
export function newClips(clips: EarlyClip[], latestDay: string, filtered: Set<string>): EarlyClip[] {
  const from = addDays(latestDay, -(NEW_DAYS - 1));
  return clips
    .filter((c) => c.row.date >= from && filtered.has(c.key))
    .sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1) || (b.perHour ?? -1) - (a.perHour ?? -1) || b.firstViews - a.firstViews);
}
