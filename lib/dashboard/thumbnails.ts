// Advanced → Thumbnail: rank clips of one platform by their raw views, most
// first, so covers of strong and weak clips can be compared side by side.
// Views are the raw numbers; nothing is computed from them.
//
// Relative imports only: tests run this file directly with Node.
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import type { RecordRow } from "./types.ts";

/** Clips younger than this are still gaining fast and are not ranked. */
export const THUMB_FRESH_DAYS = 2;

export interface ThumbClip {
  key: string;
  row: RecordRow;
  /** Views in the first two days, from daily growth; null when not measured. */
  early: number | null;
}

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
  const clips = pool
    .filter((r) => r.date < cutoff)
    .map((row) => {
      const key = recordKey(row);
      return { key, row, early: early.get(key)?.views ?? null };
    });
  // Most views first; ties put the newer clip first.
  clips.sort((a, b) => b.row.views - a.row.views || b.row.date.localeCompare(a.row.date));
  return { clips, fresh };
}
