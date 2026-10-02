// Best / worst ranking for the report range, a day or a week.
//
// Clips are compared with what is normal for the same platform + VDO type,
// otherwise "worst" would always be a Facebook post with a few hundred views
// next to YouTube videos with millions. Normal = median views of that group
// over the 30 days before the period; for ranges longer than a month (90 or
// 365 days, a year, all data) the median within the range itself.
// The card can also list clips by raw views instead ("views").
import type { RecordRow } from "@/lib/dashboard/types";

export type RankGrain = "day" | "week";
/** "index": against what is normal for the same platform + VDO type; "views": raw views. */
export type ClipOrder = "index" | "views";

/** Longer periods compare clips with the median inside the period. */
export const MAX_DAYS_FOR_PRIOR_BASELINE = 31;
export type BaselineKind = "prior30" | "within";

/** Clips under this many views are left out of "worst": almost always removed,
 * private or not yet counted, not a verdict on the content. */
export const MIN_VIEWS_FOR_WORST = 50;

export interface Period {
  start: string;
  end: string;
}

export interface RankedClip {
  row: RecordRow;
  /** Views divided by the group median; null when there is no baseline. */
  index: number | null;
  baseline: number | null;
  /** Published less than 2 days before the latest data date: views still climbing. */
  fresh: boolean;
}

export interface RankedEpisode {
  row: RecordRow;
  /** One31 rating compared with the previous 28 days' average, e.g. 0.12 = +12%. */
  vsAverage: number | null;
}

const DAY = 86400000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => toIso(new Date(toDate(iso).getTime() + days * DAY));

/** Day, or Monday–Sunday week, containing `anchor` (YYYY-MM-DD). */
export function periodFor(anchor: string, grain: RankGrain): Period {
  if (grain === "day") return { start: anchor, end: anchor };
  const weekday = (toDate(anchor).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(anchor, -weekday);
  return { start, end: addDays(start, 6) };
}

export function shiftPeriod(anchor: string, grain: RankGrain, direction: -1 | 1): string {
  return addDays(anchor, direction * (grain === "day" ? 1 : 7));
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const isTv = (r: RecordRow) => r.platform === "TV" || r.ratingTotal > 0 || r.gmmRating > 0;

/**
 * `rows` must span at least the 30 days before `period` (for baselines) and
 * should not be cut to the period; it is filtered here.
 */
export function rankClips(
  rows: RecordRow[],
  period: Period,
  latestDate: string,
  size = 5,
  order: ClipOrder = "index",
): { best: RankedClip[]; worst: RankedClip[]; total: number; baselineKind: BaselineKind } {
  const digital = rows.filter((r) => !isTv(r) && r.date);
  const days = Math.round((toDate(period.end).getTime() - toDate(period.start).getTime()) / DAY) + 1;
  const baselineKind: BaselineKind = days > MAX_DAYS_FOR_PRIOR_BASELINE ? "within" : "prior30";
  const baseStart = addDays(period.start, -30);
  const history =
    baselineKind === "within"
      ? digital.filter((r) => r.date >= period.start && r.date <= period.end && r.views > 0)
      : digital.filter((r) => r.date >= baseStart && r.date < period.start && r.views > 0);

  const byGroup = new Map<string, number[]>();
  const byPlatform = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, key: string, v: number) => {
    const list = m.get(key);
    if (list) list.push(v);
    else m.set(key, [v]);
  };
  for (const r of history) {
    push(byGroup, `${r.platform}|${r.vdoType}`, r.views);
    push(byPlatform, r.platform, r.views);
  }
  // A median of fewer than 3 clips is noise; fall back to the whole platform.
  const baselineFor = (r: RecordRow) => {
    const group = byGroup.get(`${r.platform}|${r.vdoType}`) || [];
    if (group.length >= 3) return median(group);
    const platform = byPlatform.get(r.platform) || [];
    return platform.length >= 3 ? median(platform) : null;
  };

  const freshFrom = latestDate ? addDays(latestDate, -1) : "";
  const ranked: RankedClip[] = digital
    .filter((r) => r.date >= period.start && r.date <= period.end)
    .map((row) => {
      const baseline = baselineFor(row);
      return {
        row,
        baseline,
        index: baseline ? row.views / baseline : null,
        fresh: !!freshFrom && row.date >= freshFrom,
      };
    });

  const byViews = order === "views";
  const bestFirst = byViews
    ? (a: RankedClip, b: RankedClip) => b.row.views - a.row.views || (b.index ?? -1) - (a.index ?? -1)
    : (a: RankedClip, b: RankedClip) => (b.index ?? -1) - (a.index ?? -1) || b.row.views - a.row.views;
  const best = [...ranked].sort(bestFirst).slice(0, size);
  const bestSet = new Set(best);
  // Worst leaves out clips still collecting views, clips already listed as
  // best, and clips with almost no views (removed, private or not counted).
  // By ranking it also needs a baseline to compare with.
  const worst = ranked
    .filter((x) => (byViews || x.index !== null) && !x.fresh && !bestSet.has(x) && x.row.views >= MIN_VIEWS_FOR_WORST)
    .sort(
      byViews
        ? (a, b) => a.row.views - b.row.views || (a.index ?? 0) - (b.index ?? 0)
        : (a, b) => (a.index ?? 0) - (b.index ?? 0) || a.row.views - b.row.views,
    )
    .slice(0, size);

  return { best, worst, total: ranked.length, baselineKind };
}

/** TV episodes in the period, best rating first, each against the previous 28 days. */
export function rankEpisodes(rows: RecordRow[], period: Period): RankedEpisode[] {
  const tv = rows.filter((r) => isTv(r) && r.date && r.ratingTotal > 0);
  const baseStart = addDays(period.start, -28);
  const prior = tv.filter((r) => r.date >= baseStart && r.date < period.start);
  const avg = prior.length ? prior.reduce((a, r) => a + r.ratingTotal, 0) / prior.length : null;
  return tv
    .filter((r) => r.date >= period.start && r.date <= period.end)
    .sort((a, b) => b.ratingTotal - a.ratingTotal)
    .map((row) => ({ row, vsAverage: avg ? (row.ratingTotal - avg) / avg : null }));
}
