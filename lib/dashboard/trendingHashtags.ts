// รายงาน → Trending Hashtag: hashtags of our own posts in a period (posts and
// their views), ranked, against the period before, like TikTok Creative
// Center's list. Numbers are the posts published in the period and their
// latest views (the growth history only starts in October 2026).
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";
import { parseHashtags } from "./hashtags.ts";

export interface Period {
  start: string;
  end: string;
}

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
export const days = (p: Period) => {
  const out: string[] = [];
  for (let d = p.start; d <= p.end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
};
/** The `n` days ending on `end`, and the `n` days before them. */
export function periodsEnding(end: string, n: number): { cur: Period; prev: Period } {
  const start = addDays(end, -(n - 1));
  return { cur: { start, end }, prev: { start: addDays(start, -n), end: addDays(start, -1) } };
}

const inPeriod = (r: RecordRow, p: Period) => r.platform !== "TV" && !!r.date && r.date >= p.start && r.date <= p.end;

/** Channel, show and host tags, hidden by default: they are on nearly every post and say nothing about the topic. */
export const CHANNEL_TAGS = new Set([
  "#ถกไม่เถียง", "#ทินถกไม่เถียง", "#ทินโชคกมลกิจ", "#terodigital", "#teronews", "#tero",
  "#one31", "#channelone31", "#ช่องวัน31", "#ช่องone31", "#เงินทองของจริง", "#hitzthailand", "#kidsfun", "#คิดฝัน",
]);
/** Any other tag on more than this share of the posts is hidden too (another channel's own tag). */
export const COMMON_SHARE = 0.6;

function byTag(rows: RecordRow[]): Map<string, RecordRow[]> {
  const m = new Map<string, RecordRow[]>();
  for (const r of rows) {
    for (const t of new Set(parseHashtags(r.hashtags))) {
      const list = m.get(t);
      if (list) list.push(r);
      else m.set(t, [r]);
    }
  }
  return m;
}

export interface TrendItem {
  tag: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  er: number;
  viewsPerPost: number;
  rank: number;
  /** Rank in the period before; null = not ranked then ("ใหม่"). */
  prevRank: number | null;
  /** Views against the period before (0.25 = +25%); null without a base. */
  growth: number | null;
  topicType: string;
  /** Views per platform. */
  platforms: Record<string, number>;
  /** Views of the tag's posts by publishing day, one value per day of the period. */
  daily: number[];
}

const sum = (list: RecordRow[], f: (r: RecordRow) => number) => list.reduce((a, r) => a + (f(r) || 0), 0);

/** Tags with at least `minPosts` posts in the period, most viewed first. */
export function trendingHashtags(
  rows: RecordRow[],
  cur: Period,
  prev: Period,
  opts: { hideCommon?: boolean; minPosts?: number } = {},
): { items: TrendItem[]; hidden: string[]; posts: number; withTags: number } {
  const minPosts = opts.minPosts ?? 2;
  const now = rows.filter((r) => inPeriod(r, cur));
  const before = rows.filter((r) => inPeriod(r, prev));
  const tagged = now.filter((r) => parseHashtags(r.hashtags).length);
  const groups = byTag(now);
  const hidden =
    opts.hideCommon === false
      ? []
      : [...groups.entries()].filter(([t, l]) => CHANNEL_TAGS.has(t) || (tagged.length >= 10 && l.length / tagged.length > COMMON_SHARE)).map(([t]) => t);
  const skip = new Set(hidden);

  const rank = (m: Map<string, RecordRow[]>) =>
    new Map(
      [...m.entries()]
        .filter(([t, l]) => !skip.has(t) && l.length >= minPosts)
        .sort((a, b) => sum(b[1], (r) => r.views) - sum(a[1], (r) => r.views))
        .map(([t], i) => [t, i + 1] as const),
    );
  const nowRank = rank(groups);
  const beforeGroups = byTag(before);
  const beforeRank = rank(beforeGroups);
  const dayList = days(cur);
  const dayIndex = new Map(dayList.map((d, i) => [d, i]));

  const items = [...nowRank.entries()].map(([tag, r]) => {
    const list = groups.get(tag)!;
    const views = sum(list, (x) => x.views);
    const likes = sum(list, (x) => x.likes);
    const comments = sum(list, (x) => x.comments);
    const shares = sum(list, (x) => x.shares);
    const prevViews = sum(beforeGroups.get(tag) || [], (x) => x.views);
    const topics = new Map<string, number>();
    const platforms: Record<string, number> = {};
    const daily = dayList.map(() => 0);
    for (const x of list) {
      const t = x.topicType || "ไม่ระบุ";
      topics.set(t, (topics.get(t) || 0) + 1);
      platforms[x.platform] = (platforms[x.platform] || 0) + x.views;
      const i = dayIndex.get(x.date);
      if (i !== undefined) daily[i] += x.views;
    }
    return {
      tag,
      posts: list.length,
      views,
      likes,
      comments,
      shares,
      er: views > 0 ? (likes + comments + shares) / views : 0,
      viewsPerPost: list.length ? views / list.length : 0,
      rank: r,
      prevRank: beforeRank.get(tag) ?? null,
      growth: prevViews > 0 ? (views - prevViews) / prevViews : null,
      topicType: [...topics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "ไม่ระบุ",
      platforms,
      daily,
    };
  });
  return { items: items.sort((a, b) => a.rank - b.rank), hidden, posts: now.length, withTags: tagged.length };
}

export interface HashtagDetail {
  rows: RecordRow[];
  totals: { posts: number; views: number; likes: number; comments: number; shares: number; er: number };
  daily: { date: string; posts: number; views: number }[];
  byPlatform: { name: string; posts: number; views: number }[];
  byProgram: { name: string; posts: number; views: number }[];
  /** Tags used on the same posts, most often first. */
  related: { tag: string; posts: number }[];
}

const split = (list: RecordRow[], key: (r: RecordRow) => string) => {
  const m = new Map<string, { name: string; posts: number; views: number }>();
  for (const r of list) {
    const k = key(r) || "ไม่ระบุ";
    const x = m.get(k) || { name: k, posts: 0, views: 0 };
    x.posts++;
    x.views += r.views || 0;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.views - a.views);
};

/** One tag in the period: totals, day by day, where, which programs, which tags go with it. */
export function hashtagDetail(rows: RecordRow[], tag: string, cur: Period): HashtagDetail {
  const list = rows.filter((r) => inPeriod(r, cur) && parseHashtags(r.hashtags).includes(tag)).sort((a, b) => b.views - a.views);
  const views = sum(list, (r) => r.views);
  const likes = sum(list, (r) => r.likes);
  const comments = sum(list, (r) => r.comments);
  const shares = sum(list, (r) => r.shares);
  const perDay = new Map(days(cur).map((d) => [d, { date: d, posts: 0, views: 0 }]));
  for (const r of list) {
    const d = perDay.get(r.date);
    if (d) {
      d.posts++;
      d.views += r.views || 0;
    }
  }
  const co = new Map<string, number>();
  for (const r of list) for (const t of new Set(parseHashtags(r.hashtags))) if (t !== tag) co.set(t, (co.get(t) || 0) + 1);
  return {
    rows: list,
    totals: { posts: list.length, views, likes, comments, shares, er: views > 0 ? (likes + comments + shares) / views : 0 },
    daily: [...perDay.values()],
    byPlatform: split(list, (r) => r.platform),
    byProgram: split(list, (r) => r.program),
    related: [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => ({ tag: t, posts: n })),
  };
}

/** The tag in TikTok Creative Center (TikTok-wide trend; needs a TikTok sign-in there for the details). */
export const creativeCenterUrl = (tag: string, region = "TH") =>
  `https://ads.tiktok.com/business/creativecenter/hashtag/${encodeURIComponent(tag.replace(/^#/, ""))}/pc/th?period=7&region=${region}`;
