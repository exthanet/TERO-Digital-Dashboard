// วิเคราะห์เชิงลึก → รายงานรายแพลตฟอร์ม: one platform at a time, for the report range
// and filters (program, VDO type, topic type, search; not the platform filter).
// Raw numbers from the rows; this file only sums, groups and takes medians.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";
import { parseHashtags } from "./hashtags.ts";

export const REPORT_PLATFORMS = ["YouTube", "Facebook", "Instagram", "TikTok", "TV"] as const;

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const inRange = (rows: RecordRow[], start: string, end: string) => rows.filter((r) => r.date && (!start || r.date >= start) && (!end || r.date <= end));

export interface DigitalKpis {
  views: number;
  posts: number;
  /** Median views per post. */
  medianViews: number | null;
  /** (likes + comments + shares) ÷ views. */
  er: number;
  sharesPer1k: number;
  commentsPer1k: number;
}

export function digitalKpis(rows: RecordRow[]): DigitalKpis {
  const views = rows.reduce((a, r) => a + r.views, 0);
  const sum = (f: (r: RecordRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const per1k = (n: number) => (views > 0 ? (n / views) * 1000 : 0);
  return {
    views,
    posts: rows.length,
    medianViews: median(rows.map((r) => r.views)),
    er: views > 0 ? sum((r) => r.likes + r.comments + r.shares) / views : 0,
    sharesPer1k: per1k(sum((r) => r.shares)),
    commentsPer1k: per1k(sum((r) => r.comments)),
  };
}

export interface TvKpis {
  episodes: number;
  /** Average One31 rating of the episodes with a rating. */
  rating: number | null;
  audience: number;
  /** Average GMM25 rating in the same slots. */
  gmmRating: number | null;
}

export function tvKpis(rows: RecordRow[]): TvKpis {
  const rated = rows.filter((r) => r.ratingTotal > 0);
  const gmm = rows.filter((r) => r.gmmRating > 0);
  return {
    episodes: rows.length,
    rating: rated.length ? rated.reduce((a, r) => a + r.ratingTotal, 0) / rated.length : null,
    audience: rows.reduce((a, r) => a + (r.audienceTotal || 0), 0),
    gmmRating: gmm.length ? gmm.reduce((a, r) => a + r.gmmRating, 0) / gmm.length : null,
  };
}

/** Change against the previous period; null when there is nothing to compare with. */
export const change = (now: number | null, before: number | null) => (now !== null && before !== null && before > 0 ? (now - before) / before : null);

export interface FormatStat {
  vdoType: string;
  posts: number;
  postShare: number;
  views: number;
  viewShare: number;
  medianViews: number | null;
}

/** Each VDO type: share of the posts against share of the views, and the median per post. */
export function formatMix(rows: RecordRow[]): FormatStat[] {
  const total = rows.reduce((a, r) => a + r.views, 0);
  const groups = new Map<string, RecordRow[]>();
  for (const r of rows) {
    const k = r.vdoType || "ไม่ระบุ";
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  return [...groups.entries()]
    .map(([vdoType, list]) => {
      const views = list.reduce((a, r) => a + r.views, 0);
      return {
        vdoType,
        posts: list.length,
        postShare: rows.length ? list.length / rows.length : 0,
        views,
        viewShare: total > 0 ? views / total : 0,
        medianViews: median(list.map((r) => r.views)),
      };
    })
    .sort((a, b) => b.views - a.views);
}

export interface HeatCell {
  posts: number;
  /** Median views of the posts in this weekday × hour; null under MIN_POSTS_PER_CELL. */
  medianViews: number | null;
}

/** Fewer posts than this in a cell is too little to say anything. */
export const MIN_POSTS_PER_CELL = 3;
/** Monday first, as Thai calendars and the ranking weeks. */
export const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

/** Hour of a posting time; exactly "00:00" is a placeholder (YouTube rows without a time), not midnight. */
export const hourOf = (t: string) => {
  if (/^0?0:00(:00)?$/.test((t || "").trim())) return null;
  const m = /^(\d{1,2}):\d{2}/.exec(t || "");
  const h = m ? Number(m[1]) : NaN;
  return h >= 0 && h < 24 ? h : null;
};

/**
 * Weekday (Monday = 0) × posting hour, from the post date and time (Thai time,
 * as stored). Posts without a time are counted in `noTime`.
 */
export function postingHeatmap(rows: RecordRow[]): { cells: HeatCell[][]; noTime: number; withTime: number; overallMedian: number | null } {
  const lists: number[][][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => [] as number[]));
  let noTime = 0;
  const all: number[] = [];
  for (const r of rows) {
    const h = hourOf(r.publishTime);
    if (h === null || !r.date) {
      noTime++;
      continue;
    }
    const wd = (new Date(`${r.date}T00:00:00Z`).getUTCDay() + 6) % 7;
    lists[wd][h].push(r.views);
    all.push(r.views);
  }
  return {
    cells: lists.map((day) => day.map((v) => ({ posts: v.length, medianViews: v.length >= MIN_POSTS_PER_CELL ? median(v) : null }))),
    noTime,
    withTime: all.length,
    overallMedian: median(all),
  };
}

/** The best weekday × hour cells by median views (enough posts only). */
export function bestSlots(map: ReturnType<typeof postingHeatmap>, n = 3): { day: number; hour: number; medianViews: number; posts: number }[] {
  const out: { day: number; hour: number; medianViews: number; posts: number }[] = [];
  map.cells.forEach((row, day) => row.forEach((c, hour) => c.medianViews !== null && out.push({ day, hour, medianViews: c.medianViews, posts: c.posts })));
  return out.sort((a, b) => b.medianViews - a.medianViews).slice(0, n);
}

export interface HashtagStat {
  tag: string;
  posts: number;
  views: number;
  medianViews: number;
  /** Median views per post of this tag ÷ the platform's median in the range. */
  index: number | null;
  er: number;
  /** Share of its posts that carry the tag in the title (the rest: caption / description only). */
  inTitle: number;
  rows: RecordRow[];
}

/** Tags used on fewer posts than this are left out: too few to compare. */
export const MIN_POSTS_PER_TAG = 3;

/** Hashtags of the posts in the range, with how their posts did against the platform's normal. */
export function hashtagStats(rows: RecordRow[], minPosts = MIN_POSTS_PER_TAG): { tags: HashtagStat[]; withTags: number; total: number } {
  const platformMedian = median(rows.map((r) => r.views));
  const groups = new Map<string, RecordRow[]>();
  let withTags = 0;
  for (const r of rows) {
    const tags = parseHashtags(r.hashtags);
    if (tags.length) withTags++;
    for (const t of tags) {
      const list = groups.get(t);
      if (list) list.push(r);
      else groups.set(t, [r]);
    }
  }
  const tags = [...groups.entries()]
    .filter(([, list]) => list.length >= minPosts)
    .map(([tag, list]) => {
      const views = list.reduce((a, r) => a + r.views, 0);
      const med = median(list.map((r) => r.views)) || 0;
      return {
        tag,
        posts: list.length,
        views,
        medianViews: med,
        index: platformMedian ? med / platformMedian : null,
        er: views > 0 ? list.reduce((a, r) => a + r.likes + r.comments + r.shares, 0) / views : 0,
        inTitle: list.filter((r) => String(r.topic || "").toLowerCase().includes(tag)).length / list.length,
        rows: [...list].sort((a, b) => b.views - a.views),
      };
    })
    .sort((a, b) => b.posts - a.posts || b.views - a.views);
  return { tags, withTags, total: rows.length };
}
