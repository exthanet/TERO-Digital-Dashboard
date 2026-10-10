// วิเคราะห์เชิงลึก → รายงานรายแพลตฟอร์ม: the numbers behind the platform-styled
// boards (YouTube Studio, TikTok Studio, Meta Business Suite, Instagram, TV).
// Raw numbers from the rows, YouTube Analytics and growthDaily; this file only
// sums, groups, divides and takes medians. Days are publish dates, as on the
// rest of the dashboard.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";
import type { GrowthEntry } from "./growth.ts";
import { addDays, daysBetween, recordKey } from "./growth.ts";
import { MIN_POSTS_PER_CELL, hourOf } from "./platformReport.ts";
import { joinVideos, type YtDeepDiveData } from "./ytDeepDive.ts";

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const per1k = (n: number, views: number) => (views > 0 ? (n / views) * 1000 : 0);

/** YouTube Analytics per clip (lifetime): watch hours and subscribers gained. */
export interface DeepNumbers {
  hours: number;
  subs: number;
}

export interface DayPoint {
  date: string;
  views: number;
  posts: number;
  /** Median views per post of that day's posts (null without posts). */
  medianViews: number | null;
  /** (Like + Comment + Share) ÷ views of the posts published that day. */
  er: number;
  sharesPer1k: number;
  commentsPer1k: number;
  /** YouTube Analytics only (0 without it). */
  hours: number;
  subs: number;
}

/** Every day of the range (publish date): posts, views, interaction; days without posts are 0. */
export function dailySeries(rows: RecordRow[], start: string, end: string, deep?: Map<string, DeepNumbers>): DayPoint[] {
  if (!start || !end) return [];
  const sums = new Map<string, { list: number[]; views: number; posts: number; likes: number; comments: number; shares: number; hours: number; subs: number }>();
  for (const d of daysBetween(start, end)) sums.set(d, { list: [], views: 0, posts: 0, likes: 0, comments: 0, shares: 0, hours: 0, subs: 0 });
  for (const r of rows) {
    const s = sums.get(r.date);
    if (!s) continue;
    s.views += r.views;
    s.list.push(r.views);
    s.posts += 1;
    s.likes += r.likes;
    s.comments += r.comments;
    s.shares += r.shares;
    const x = deep?.get(recordKey(r));
    if (x) {
      s.hours += x.hours;
      s.subs += x.subs;
    }
  }
  return [...sums.entries()].map(([date, s]) => ({
    date,
    views: s.views,
    posts: s.posts,
    medianViews: median(s.list),
    er: s.views > 0 ? (s.likes + s.comments + s.shares) / s.views : 0,
    sharesPer1k: per1k(s.shares, s.views),
    commentsPer1k: per1k(s.comments, s.views),
    hours: s.hours,
    subs: s.subs,
  }));
}

/** The most viewed posts. */
export const topPosts = (rows: RecordRow[], n: number) => [...rows].sort((a, b) => b.views - a.views).slice(0, n);

export interface GroupStat {
  key: string;
  posts: number;
  views: number;
  postShare: number;
  viewShare: number;
  medianViews: number | null;
  likesPer1k: number;
  commentsPer1k: number;
  sharesPer1k: number;
}

/** Posts grouped by a field (VDO type, topic type…): share of posts and views, median, interaction per 1,000 views. */
export function groupStats(rows: RecordRow[], keyOf: (r: RecordRow) => string): GroupStat[] {
  const total = rows.reduce((a, r) => a + r.views, 0);
  const groups = new Map<string, RecordRow[]>();
  for (const r of rows) {
    const k = keyOf(r) || "ไม่ระบุ";
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const views = list.reduce((a, r) => a + r.views, 0);
      const sum = (f: (r: RecordRow) => number) => list.reduce((a, r) => a + f(r), 0);
      return {
        key,
        posts: list.length,
        views,
        postShare: rows.length ? list.length / rows.length : 0,
        viewShare: total > 0 ? views / total : 0,
        medianViews: median(list.map((r) => r.views)),
        likesPer1k: per1k(sum((r) => r.likes), views),
        commentsPer1k: per1k(sum((r) => r.comments), views),
        sharesPer1k: per1k(sum((r) => r.shares), views),
      };
    })
    .sort((a, b) => b.views - a.views);
}

/** Like / Comment / Share: how the interaction splits. */
export function interactionMix(rows: RecordRow[]) {
  const likes = rows.reduce((a, r) => a + r.likes, 0);
  const comments = rows.reduce((a, r) => a + r.comments, 0);
  const shares = rows.reduce((a, r) => a + r.shares, 0);
  return { likes, comments, shares, total: likes + comments + shares };
}

/** Share of the posts that got at least one share / one comment, and the ER, as 0–1 rings. */
export function reachRings(rows: RecordRow[]) {
  const views = rows.reduce((a, r) => a + r.views, 0);
  const inter = rows.reduce((a, r) => a + r.likes + r.comments + r.shares, 0);
  return {
    er: views > 0 ? inter / views : 0,
    sharedPosts: rows.length ? rows.filter((r) => r.shares > 0).length / rows.length : 0,
    commentedPosts: rows.length ? rows.filter((r) => r.comments > 0).length / rows.length : 0,
  };
}

/** Median views per post by publish hour (Thai time as recorded); too few posts = null. */
export function hourMedians(rows: RecordRow[]): { hour: number; posts: number; medianViews: number | null }[] {
  const byHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const r of rows) {
    const h = hourOf(r.publishTime);
    if (h !== null) byHour[h].push(r.views);
  }
  return byHour.map((v, hour) => ({ hour, posts: v.length, medianViews: v.length >= MIN_POSTS_PER_CELL ? median(v) : null }));
}

/** Instagram Reels: skip rate (%) and average watch seconds, both weighted by views. */
export function skipStats(rows: RecordRow[]): { skip: number | null; watchSec: number | null; posts: number } {
  const withSkip = rows.filter((r) => r.skipRate !== null && r.views > 0);
  const sv = withSkip.reduce((a, r) => a + r.views, 0);
  const withWatch = rows.filter((r) => r.avgWatchSec > 0 && r.views > 0);
  const wv = withWatch.reduce((a, r) => a + r.views, 0);
  return {
    skip: sv > 0 ? withSkip.reduce((a, r) => a + (r.skipRate as number) * r.views, 0) / sv : null,
    watchSec: wv > 0 ? withWatch.reduce((a, r) => a + r.avgWatchSec * r.views, 0) / wv : null,
    posts: withSkip.length,
  };
}

// ---------- YouTube Analytics (Deep Dive permission) ----------

export interface YtStudio {
  /** Per post key. */
  byKey: Map<string, DeepNumbers>;
  hours: number;
  subs: number;
  /** Clips of the range that YouTube Analytics has numbers for. */
  matched: number;
  traffic: { source: string; views: number; share: number }[];
  /** Retention curve of the most viewed clip that has one. */
  retention: { id: string; title: string; points: { at: number; watch: number }[] } | null;
}

export function ytStudio(data: YtDeepDiveData, rows: RecordRow[]): YtStudio {
  const items = joinVideos(data, rows);
  const byKey = new Map<string, DeepNumbers>();
  const traffic = new Map<string, number>();
  let hours = 0;
  let subs = 0;
  for (const x of items) {
    const h = (x.v.views * x.v.avgViewSec) / 3600;
    hours += h;
    subs += x.v.subs;
    byKey.set(recordKey(x.row), { hours: h, subs: x.v.subs });
    for (const [s, v] of Object.entries(x.v.traffic || {})) traffic.set(s, (traffic.get(s) || 0) + v);
  }
  const tTotal = [...traffic.values()].reduce((a, v) => a + v, 0);
  const curves = new Map(data.retention.map((c) => [c.id, c.points]));
  const withCurve = items.find((x) => curves.get(x.v.id)?.length);
  return {
    byKey,
    hours,
    subs,
    matched: items.length,
    traffic: [...traffic.entries()]
      .map(([source, views]) => ({ source, views, share: tTotal > 0 ? views / tTotal : 0 }))
      .sort((a, b) => b.views - a.views),
    retention: withCurve ? { id: withCurve.v.id, title: withCurve.row.topic, points: (curves.get(withCurve.v.id) || []).map((p) => ({ at: p.at, watch: p.watch })) } : null,
  };
}

// ---------- growthDaily: what the posts gained ----------

/** The last `n` days up to `end`, oldest first. */
export const lastDays = (end: string, n: number) => (end ? Array.from({ length: n }, (_, i) => addDays(end, i - n + 1)) : []);

/** Views gained per day by the given posts, and the posts that gained most over those days. */
export function recentGains(days: Map<string, GrowthEntry[] | null>, keys: Set<string>, order: string[], top = 3) {
  const per = new Map<string, number>();
  const series = order.map((date) => {
    const list = days.get(date);
    let views = 0;
    for (const e of list || []) {
      if (!keys.has(e[0])) continue;
      views += e[1];
      per.set(e[0], (per.get(e[0]) || 0) + e[1]);
    }
    return { date, views, missing: !list };
  });
  return {
    series,
    total: series.reduce((a, d) => a + d.views, 0),
    top: [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([key, views]) => ({ key, views })),
  };
}

// ---------- TV ----------

export type TvChannel = "One31" | "GMM25";
const ratingOf = (r: RecordRow, ch: TvChannel) => (ch === "GMM25" ? r.gmmRating : r.ratingTotal);

/** Each episode's rating on the channel (rated ones only, by date) and their average. */
export function episodeRatings(rows: RecordRow[], ch: TvChannel) {
  const list = rows
    .filter((r) => r.platform === "TV" && ratingOf(r, ch) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, rating: ratingOf(r, ch), topic: r.topic || r.episodeId || "", row: r }));
  return { list, avg: list.length ? list.reduce((a, x) => a + x.rating, 0) / list.length : null };
}

export const TV_ZONES = [
  { key: "ratingBkk", label: "กรุงเทพฯ" },
  { key: "ratingUrban", label: "ในเมือง" },
  { key: "ratingBkkUrban", label: "กรุงเทพฯ + ในเมือง" },
  { key: "ratingRural", label: "นอกเมือง" },
] as const;

/** One31 rating per area, averaged over the episodes that have it (the workbook has areas for One31 only). */
export function zoneRatings(rows: RecordRow[]) {
  const tv = rows.filter((r) => r.platform === "TV");
  return TV_ZONES.map((z) => {
    const vals = tv.map((r) => r[z.key]).filter((v) => v > 0);
    return { ...z, rating: vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null };
  });
}
