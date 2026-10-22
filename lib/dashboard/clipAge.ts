// รายงานผล → "5 คลิปดี / แย่ที่สุด" at the same age: every clip is judged by the views it
// had in its first AGE_DAYS days (from growthDaily, the views gained each day), so a clip
// posted on the 1st is not ahead of one posted on the 28th just for being older.
// Content on several platforms adds up its posts, each over its own first days.
// Clips younger than AGE_DAYS on the newest data day, or posted before the daily
// data began, are left out (and counted).
//
// Relative imports only: tests run this file directly with Node.
import { groupContents, type ContentGroup } from "./contentGroups.ts";
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import type { RecordRow } from "./types.ts";

export const AGE_DAYS = 7;
/** As ranking.ts: under this a clip was usually taken down or not counted yet. */
const MIN_VIEWS_FOR_WORST = 50;

const isTv = (r: RecordRow) => r.platform === "TV";
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Views of one post in its first `age` days: the gains filed on its posting day and
 * the days after. null when a day of that window has no data, or the post never
 * shows up in it (posted before the daily data began, or not tracked).
 */
export function viewsAtAge(row: RecordRow, days: Map<string, GrowthEntry[] | null>, age = AGE_DAYS): number | null {
  const key = recordKey(row);
  if (!key || !row.date) return null;
  let total = 0;
  let seen = false;
  for (let i = 0; i < age; i++) {
    const entries = days.get(addDays(row.date, i));
    if (!entries) return null;
    const e = entries.find((x) => x[0] === key);
    if (e) {
      seen = true;
      total += e[1];
    }
  }
  return seen ? total : null;
}

export interface AgedContent {
  group: ContentGroup;
  /** Views in the first AGE_DAYS days, all its posts added up. */
  ageViews: number;
  /** The same per platform, most first. */
  agePlatforms: { platform: string; views: number }[];
  /** ageViews ÷ the month's median of content of the same kind at the same age; null under 3 such pieces. */
  index: number | null;
  baseline: number | null;
}

/**
 * Best and worst of the period by views at the same age. Normal = the median, in
 * the same period, of content of the same kind (one platform: same platform +
 * format; several: as many platforms), then as many platforms, then all.
 */
export function rankContentsAtAge(
  rows: RecordRow[],
  period: { start: string; end: string },
  days: Map<string, GrowthEntry[] | null>,
  size = 5,
  age = AGE_DAYS,
): { best: AgedContent[]; worst: AgedContent[]; total: number; ranked: number; young: number; noData: number } {
  const groups = groupContents(rows.filter((r) => !isTv(r) && r.date)).filter((g) => g.date >= period.start && g.date <= period.end);
  const loaded = [...days.entries()].filter(([, v]) => v).map(([d]) => d).sort();
  const lastDay = loaded[loaded.length - 1] || "";
  let young = 0;
  let noData = 0;
  const aged: AgedContent[] = [];
  for (const g of groups) {
    // Every post needs its whole first-days window in the data.
    if (g.posts.some((p) => !lastDay || addDays(p.date, age - 1) > lastDay)) {
      young++;
      continue;
    }
    const per = g.posts.map((p) => ({ p, v: viewsAtAge(p, days, age) }));
    if (per.some((x) => x.v === null)) {
      noData++;
      continue;
    }
    const byPlatform = new Map<string, number>();
    for (const { p, v } of per) byPlatform.set(p.platform, (byPlatform.get(p.platform) || 0) + (v as number));
    aged.push({
      group: g,
      ageViews: per.reduce((a, x) => a + (x.v as number), 0),
      agePlatforms: [...byPlatform].map(([platform, views]) => ({ platform, views })).sort((a, b) => b.views - a.views),
      index: null,
      baseline: null,
    });
  }
  const keyOf = (g: ContentGroup) => (g.platforms.length === 1 ? `1|${g.lead.platform}|${g.lead.vdoType}` : `n|${g.platforms.length}`);
  const byKey = new Map<string, number[]>();
  const byCount = new Map<number, number[]>();
  for (const a of aged) {
    byKey.set(keyOf(a.group), [...(byKey.get(keyOf(a.group)) || []), a.ageViews]);
    byCount.set(a.group.platforms.length, [...(byCount.get(a.group.platforms.length) || []), a.ageViews]);
  }
  const all = aged.map((a) => a.ageViews);
  for (const a of aged) {
    for (const list of [byKey.get(keyOf(a.group)) || [], byCount.get(a.group.platforms.length) || [], all]) {
      if (list.length >= 3) {
        a.baseline = median(list);
        break;
      }
    }
    a.index = a.baseline ? a.ageViews / a.baseline : null;
  }
  const best = [...aged].sort((a, b) => b.ageViews - a.ageViews || (b.index ?? -1) - (a.index ?? -1)).slice(0, size);
  const bestSet = new Set(best);
  const worst = aged
    .filter((a) => !bestSet.has(a) && a.ageViews >= MIN_VIEWS_FOR_WORST)
    .sort((a, b) => a.ageViews - b.ageViews || (a.index ?? 0) - (b.index ?? 0))
    .slice(0, size);
  return { best, worst, total: groups.length, ranked: aged.length, young, noData };
}
