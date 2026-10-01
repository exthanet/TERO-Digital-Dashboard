// Advanced → Thumbnail: rank clips of one platform by how their views compare
// with the median of the same format in the range, so covers of strong and
// weak clips can be compared side by side. Views are the raw numbers.
//
// Relative imports only: tests run this file directly with Node.
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import type { RecordRow } from "./types.ts";

/** Clips younger than this are still gaining fast and are not ranked. */
export const THUMB_FRESH_DAYS = 2;

export interface ThumbClip {
  key: string;
  row: RecordRow;
  /** views ÷ median views of the same platform + format; null when fewer than 5 to compare. */
  index: number | null;
  median: number | null;
  /** Views in the first two days, from daily growth; null when not measured. */
  early: number | null;
  earlyIndex: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Views in a clip's first two days: the gains filed for it up to the day after
 * it was posted, counted only when its first appearance (new-post entry) is in `days`.
 */
export function earlyViews(days: Map<string, GrowthEntry[] | null>): Map<string, { views: number; first: string }> {
  const firstSeen = new Map<string, string>();
  const sorted = [...days.keys()].sort();
  for (const day of sorted) for (const e of days.get(day) || []) if (e[5] && !firstSeen.has(e[0])) firstSeen.set(e[0], day);
  const out = new Map<string, { views: number; first: string }>();
  for (const [key, first] of firstSeen) {
    const last = addDays(first, 1);
    let views = 0;
    for (const day of sorted) {
      if (day < first || day > last) continue;
      for (const e of days.get(day) || []) if (e[0] === key) views += e[1];
    }
    // Both days must be on file, or the figure would be one day only.
    if (days.get(last)) out.set(key, { views, first });
  }
  return out;
}

export function rankThumbnails(
  rows: RecordRow[],
  platform: string,
  latestDate: string,
  early: Map<string, { views: number; first: string }> = new Map(),
): { clips: ThumbClip[]; fresh: number } {
  const cutoff = addDays(latestDate, -(THUMB_FRESH_DAYS - 1));
  const pool = rows.filter((r) => r.platform === platform && r.views > 0);
  const fresh = pool.filter((r) => r.date >= cutoff).length;
  const ranked = pool.filter((r) => r.date < cutoff);
  const groups = new Map<string, RecordRow[]>();
  for (const r of ranked) groups.set(r.vdoType, [...(groups.get(r.vdoType) || []), r]);
  const medians = new Map<string, number | null>();
  const earlyMedians = new Map<string, number | null>();
  for (const [vt, list] of groups) {
    medians.set(vt, list.length >= 5 ? median(list.map((r) => r.views)) : null);
    const e = list.map((r) => early.get(recordKey(r))?.views).filter((v): v is number => v !== undefined);
    earlyMedians.set(vt, e.length >= 5 ? median(e) : null);
  }
  const clips = ranked.map((row) => {
    const key = recordKey(row);
    const m = medians.get(row.vdoType) ?? null;
    const e = early.get(key)?.views ?? null;
    const em = earlyMedians.get(row.vdoType) ?? null;
    return { key, row, median: m, index: m ? row.views / m : null, early: e, earlyIndex: e !== null && em ? e / em : null };
  });
  // Strongest first: by the index (format-fair), then by views when there is no index.
  clips.sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || b.row.views - a.row.views);
  return { clips, fresh };
}
