// Daily growth (growthDaily/{day}): how much each post gained on a day.
//
// The sync runs every morning. For each post it updates, gain = new number −
// the number masterData held before the run (the previous morning). The gain
// is filed under the day before the sync day, when those views happened.
// New posts count from 0. Posts that turn up late (published more than a day
// before) are left out: their numbers built up over many days, not one.
//
// Shared by the sync (lib/integrations/growthWriter.ts) and the dashboard.
// Relative imports only: Node scripts run this file directly.
import { postId } from "./postKey.ts";
import type { RecordRow } from "./types.ts";

/** [post key, views, likes, comments, shares, 1 = new post that day]. Short: a day can hold thousands. */
export type GrowthEntry = [string, number, number, number, number, number];

/** Longest range the growth page loads (one document per day). */
export const GROWTH_MAX_DAYS = 92;

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Every day from start to end, inclusive. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A second sync on the same day adds its gains to the first one's. */
export function mergeGrowth(a: GrowthEntry[], b: GrowthEntry[]): GrowthEntry[] {
  const byKey = new Map<string, GrowthEntry>();
  for (const e of a) byKey.set(e[0], [...e] as GrowthEntry);
  for (const e of b) {
    const x = byKey.get(e[0]);
    if (!x) byKey.set(e[0], [...e] as GrowthEntry);
    else byKey.set(e[0], [e[0], x[1] + e[1], x[2] + e[2], x[3] + e[3], x[4] + e[4], x[5] || e[5]]);
  }
  return [...byKey.values()];
}

// ---------- dashboard side ----------

export const recordKey = (r: Pick<RecordRow, "platform" | "url" | "contentId">) => {
  const id = postId(r.platform, r.url) || postId(r.platform, r.contentId);
  return id ? `${r.platform}|${id}` : "";
};

export interface GrowthClip {
  key: string;
  row: RecordRow;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** At least one day in the range had a lower number than the day before. */
  dropped: boolean;
}

export interface GrowthSummary {
  /** Days in the range that have growth data. */
  daysWithData: number;
  views: number;
  engagement: number;
  /** Clips whose views went up in the range. */
  clipsGaining: number;
  /** Views gained by clips published before the range started. */
  viewsFromOlder: number;
  /** Per day, per platform: views gained. */
  daily: { date: string; hasData: boolean; [platform: string]: number | string | boolean }[];
  platforms: string[];
  clips: GrowthClip[];
  /** Entries whose post is not in masterData (or hidden by the filters' row set). */
  unmatched: number;
  /** Day/post pairs where a number went down. */
  drops: number;
}

/**
 * Add up the days of a range for the rows that pass the dashboard filters.
 * `days` maps each day to its entries, or null when that day has no data.
 */
export function summarizeGrowth(
  rangeDays: string[],
  days: Map<string, GrowthEntry[] | null>,
  rows: RecordRow[],
  rangeStart: string,
): GrowthSummary {
  const byKey = new Map<string, RecordRow>();
  for (const r of rows) {
    if (r.platform === "TV") continue;
    const k = recordKey(r);
    if (k && !byKey.has(k)) byKey.set(k, r);
  }
  const clips = new Map<string, GrowthClip>();
  const platforms = new Set<string>();
  const daily: GrowthSummary["daily"] = [];
  let unmatched = 0;
  let drops = 0;
  let daysWithData = 0;
  for (const day of rangeDays) {
    const entries = days.get(day);
    const point: GrowthSummary["daily"][number] = { date: day, hasData: !!entries };
    if (entries) {
      daysWithData++;
      for (const [key, v, l, c, s] of entries) {
        const row = byKey.get(key);
        if (!row) {
          unmatched++;
          continue;
        }
        const dropped = v < 0 || l < 0 || c < 0 || s < 0;
        if (dropped) drops++;
        const clip = clips.get(key) || { key, row, views: 0, likes: 0, comments: 0, shares: 0, dropped: false };
        clip.views += v;
        clip.likes += l;
        clip.comments += c;
        clip.shares += s;
        clip.dropped ||= dropped;
        clips.set(key, clip);
        platforms.add(row.platform);
        point[row.platform] = Number(point[row.platform] || 0) + v;
      }
    }
    daily.push(point);
  }
  const list = [...clips.values()];
  return {
    daysWithData,
    views: list.reduce((a, x) => a + x.views, 0),
    engagement: list.reduce((a, x) => a + x.likes + x.comments + x.shares, 0),
    clipsGaining: list.filter((x) => x.views > 0).length,
    viewsFromOlder: list.filter((x) => x.row.date < rangeStart).reduce((a, x) => a + x.views, 0),
    daily,
    platforms: [...platforms].sort(),
    clips: list.sort((a, b) => b.views - a.views),
    unmatched,
    drops,
  };
}
