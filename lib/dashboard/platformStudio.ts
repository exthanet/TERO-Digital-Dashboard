// วิเคราะห์เชิงลึก → รายงานรวมแพลตฟอร์ม: the numbers behind the platform-styled
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
  likes: number;
  comments: number;
  shares: number;
  /** Like + Comment + Share. */
  engagement: number;
  /** Facebook: impressions and link clicks of the posts that report them. */
  impressions: number;
  linkClicks: number;
  /** YouTube Analytics only (0 without it). */
  hours: number;
  subs: number;
}

/** Every day of the range (publish date): posts, views, interaction; days without posts are 0. */
export function dailySeries(rows: RecordRow[], start: string, end: string, deep?: Map<string, DeepNumbers>): DayPoint[] {
  if (!start || !end) return [];
  const sums = new Map<string, { list: number[]; views: number; posts: number; likes: number; comments: number; shares: number; impressions: number; linkClicks: number; hours: number; subs: number }>();
  for (const d of daysBetween(start, end)) sums.set(d, { list: [], views: 0, posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0, linkClicks: 0, hours: 0, subs: 0 });
  for (const r of rows) {
    const s = sums.get(r.date);
    if (!s) continue;
    s.views += r.views;
    s.list.push(r.views);
    s.posts += 1;
    s.likes += r.likes;
    s.comments += r.comments;
    s.shares += r.shares;
    s.impressions += r.impressions || 0;
    s.linkClicks += r.linkClicks || 0;
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
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    engagement: s.likes + s.comments + s.shares,
    impressions: s.impressions,
    linkClicks: s.linkClicks,
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

// ---------- รายงานรวมแพลตฟอร์ม: every platform together ----------

export const DIGITAL = ["YouTube", "TikTok", "Facebook", "Instagram"] as const;

/** Views per day (publish date) of each platform, for the Cross Platform chart. */
export function crossDaily(rows: RecordRow[], start: string, end: string, platforms: readonly string[] = DIGITAL): Record<string, number | string>[] {
  if (!start || !end) return [];
  const by = new Map<string, Record<string, number | string>>();
  for (const d of daysBetween(start, end)) by.set(d, Object.fromEntries([["date", d], ...platforms.map((p) => [p, 0])]));
  for (const r of rows) {
    const day = by.get(r.date);
    if (day && platforms.includes(r.platform)) day[r.platform] = (day[r.platform] as number) + r.views;
  }
  return [...by.values()];
}

export const STRENGTH_AXES = [
  { key: "views", label: "วิวรวม" },
  { key: "posts", label: "จำนวนโพสต์" },
  { key: "medianViews", label: "วิวต่อโพสต์" },
  { key: "er", label: "ER" },
  { key: "sharesPer1k", label: "แชร์ / 1K วิว" },
  { key: "commentsPer1k", label: "คอมเมนต์ / 1K วิว" },
] as const;

/** Each platform's numbers, and each as a share of the best platform on that axis (1 = the best). */
export function strengths(rows: RecordRow[], platforms: readonly string[] = DIGITAL) {
  const raw = platforms.map((p) => {
    const list = rows.filter((r) => r.platform === p);
    const views = list.reduce((a, r) => a + r.views, 0);
    const sum = (f: (r: RecordRow) => number) => list.reduce((a, r) => a + f(r), 0);
    return {
      platform: p,
      views,
      posts: list.length,
      medianViews: median(list.map((r) => r.views)) || 0,
      er: views > 0 ? sum((r) => r.likes + r.comments + r.shares) / views : 0,
      sharesPer1k: per1k(sum((r) => r.shares), views),
      commentsPer1k: per1k(sum((r) => r.comments), views),
    };
  });
  const best = Object.fromEntries(STRENGTH_AXES.map((a) => [a.key, Math.max(0, ...raw.map((x) => x[a.key]))]));
  return {
    raw,
    radar: STRENGTH_AXES.map((a) => ({ axis: a.label, ...Object.fromEntries(raw.map((x) => [x.platform, best[a.key] > 0 ? x[a.key] / best[a.key] : 0])) })),
  };
}

export interface TagRank {
  tag: string;
  rank: number;
  /** Places gained since the comparison period (+ = up); null = new or no comparison. */
  move: number | null;
  posts: number;
  views: number;
  medianViews: number;
  er: number;
  rows: RecordRow[];
}

/** Hashtags by views (or by how often they were used), channel / show tags left out, with the move against the period before. */
export function hashtagRanking(rows: RecordRow[], prev: RecordRow[], hidden: Set<string>, minPosts = 2, order: "posts" | "views" = "posts"): TagRank[] {
  const rank = (list: RecordRow[]) => {
    const by = new Map<string, RecordRow[]>();
    for (const r of list) for (const t of new Set(String(r.hashtags || "").split(/\s+/).filter((x) => x.startsWith("#")))) {
      if (hidden.has(t)) continue;
      let g = by.get(t);
      if (!g) by.set(t, (g = []));
      g.push(r);
    }
    return [...by.entries()]
      .filter(([, g]) => g.length >= minPosts)
      .map(([tag, g]) => {
        const views = g.reduce((a, r) => a + r.views, 0);
        return { tag, posts: g.length, views, medianViews: median(g.map((r) => r.views)) || 0, er: views > 0 ? g.reduce((a, r) => a + r.likes + r.comments + r.shares, 0) / views : 0, rows: [...g].sort((a, b) => b.views - a.views) };
      })
      .sort((a, b) => (order === "views" ? b.views - a.views || b.posts - a.posts : b.posts - a.posts || b.views - a.views));
  };
  const before = new Map(rank(prev).map((x, i) => [x.tag, i + 1]));
  return rank(rows).map((x, i) => {
    const was = before.get(x.tag);
    return { ...x, rank: i + 1, move: prev.length && was ? was - (i + 1) : null };
  });
}

/** For one tag: posts and views per platform, and the tags most often used with it. */
export function tagDetail(t: TagRank, hidden: Set<string>, platforms: readonly string[] = DIGITAL) {
  const byPlatform = platforms.map((p) => {
    const list = t.rows.filter((r) => r.platform === p);
    return { platform: p, posts: list.length, views: list.reduce((a, r) => a + r.views, 0) };
  });
  const co = new Map<string, number>();
  for (const r of t.rows) for (const x of new Set(String(r.hashtags || "").split(/\s+/).filter((y) => y.startsWith("#")))) if (x !== t.tag && !hidden.has(x)) co.set(x, (co.get(x) || 0) + 1);
  return { byPlatform, together: [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, posts]) => ({ tag, posts })) };
}

// ---------- รายงานรวมแพลตฟอร์ม: top of the page (one metric switch for all) ----------

export type PageMetric = "views" | "posts" | "er";
export const PAGE_METRICS: { id: PageMetric; label: string }[] = [
  { id: "views", label: "ยอดวิว" },
  { id: "posts", label: "จำนวนโพสต์" },
  { id: "er", label: "ER" },
];

/** A group's value for the metric: views, posts, or (Like + Comment + Share) ÷ views. */
export function metricOf(rows: RecordRow[], m: PageMetric): number {
  if (m === "posts") return rows.length;
  const views = rows.reduce((a, r) => a + r.views, 0);
  if (m === "views") return views;
  return views > 0 ? rows.reduce((a, r) => a + r.likes + r.comments + r.shares, 0) / views : 0;
}

/** Each digital platform's value for the metric, biggest first. */
export function platformValues(rows: RecordRow[], m: PageMetric, platforms: readonly string[] = DIGITAL) {
  return platforms.map((p) => ({ platform: p, value: metricOf(rows.filter((r) => r.platform === p), m) })).sort((a, b) => b.value - a.value);
}

/** The topic types (ประเภทเนื้อหา) by the metric, digital posts only, top n. */
export function topTopics(rows: RecordRow[], m: PageMetric, n = 8) {
  const by = new Map<string, RecordRow[]>();
  for (const r of rows) {
    if (!(DIGITAL as readonly string[]).includes(r.platform)) continue;
    const k = r.topicType || "ไม่ระบุ";
    let g = by.get(k);
    if (!g) by.set(k, (g = []));
    g.push(r);
  }
  return [...by.entries()]
    .map(([topic, g]) => ({ topic, value: metricOf(g, m), posts: g.length }))
    .filter((x) => m !== "er" || x.posts >= 5)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Per day: digital views (publish date) and TV audience of the episodes aired that day. */
export function digitalVsTv(rows: RecordRow[], start: string, end: string) {
  if (!start || !end) return [];
  const by = new Map(daysBetween(start, end).map((d) => [d, { date: d, digital: 0, tv: 0 }]));
  for (const r of rows) {
    const d = by.get(r.date);
    if (!d) continue;
    if (r.platform === "TV") d.tv += r.audienceTotal || 0;
    else if ((DIGITAL as readonly string[]).includes(r.platform)) d.digital += r.views;
  }
  return [...by.values()];
}

/** Facebook tiles: impressions (การเข้าถึง) and link clicks over the posts that have them. */
export function facebookReach(rows: RecordRow[]) {
  const withImpr = rows.filter((r) => r.impressions > 0);
  const withClicks = rows.filter((r) => r.linkClicks !== null && r.linkClicks !== undefined);
  return {
    impressions: withImpr.reduce((a, r) => a + r.impressions, 0),
    impressionPosts: withImpr.length,
    linkClicks: withClicks.reduce((a, r) => a + (r.linkClicks || 0), 0),
    clickPosts: withClicks.length,
  };
}

/** Share of the posts that carry at least one hashtag. */
export const hashtagShare = (rows: RecordRow[]) => (rows.length ? rows.filter((r) => /#\S/.test(String(r.hashtags || ""))).length / rows.length : 0);

/** Views per publish day of a tag's posts over the last `n` days of the range (the small line in the list). */
export function tagDaily(t: TagRank, end: string, n = 7): number[] {
  const days = lastDays(end, n);
  const by = new Map(days.map((d) => [d, 0]));
  for (const r of t.rows) if (by.has(r.date)) by.set(r.date, (by.get(r.date) || 0) + r.views);
  return days.map((d) => by.get(d) || 0);
}

/** The TV workbook source of a channel (GMM25 by name, One31 = the other one). */
export const sourceOf = <S extends { channel: string }>(sources: S[], ch: TvChannel) => sources.find((s) => (ch === "GMM25" ? /gmm/i.test(s.channel) : !/gmm/i.test(s.channel)));

/** ถกไม่เถียง's own rating per day on a channel (merged TV rows: One31 in ratingTotal, GMM25 in gmmRating). */
export function ownRatings(rows: RecordRow[], program: string, ch: TvChannel): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.platform !== "TV" || r.program !== program) continue;
    const v = ch === "GMM25" ? r.gmmRating : r.ratingTotal;
    if (v > 0) m.set(r.date, v);
  }
  return m;
}
