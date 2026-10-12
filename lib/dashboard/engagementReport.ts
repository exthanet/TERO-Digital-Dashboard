// รายงานรายเดือน → "Like & Comment": who liked and commented on the month's digital
// posts, by clip, platform and topic type. Raw likes and comments from the rows;
// this file only sums, ranks and divides by views (per 1,000 views, so big and
// small clips compare fairly).
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";

export const ENGAGE_PLATFORMS = ["YouTube", "TikTok", "Facebook", "Instagram"] as const;
/** Topic types with fewer posts than this are left out of the topic ranking. */
export const MIN_TOPIC_POSTS = 5;

const isDigital = (r: RecordRow) => (ENGAGE_PLATFORMS as readonly string[]).includes(r.platform);
const per1k = (n: number, views: number) => (views > 0 ? (n / views) * 1000 : null);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface EngageTotals {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  /** Per 1,000 views; null without views. */
  likesPer1k: number | null;
  commentsPer1k: number | null;
}

export function engageTotals(rows: RecordRow[]): EngageTotals {
  const d = rows.filter(isDigital);
  const views = d.reduce((a, r) => a + r.views, 0);
  const likes = d.reduce((a, r) => a + r.likes, 0);
  const comments = d.reduce((a, r) => a + r.comments, 0);
  return { posts: d.length, views, likes, comments, likesPer1k: per1k(likes, views), commentsPer1k: per1k(comments, views) };
}

/** The clips with the most likes (or comments), highest first; ties by views. */
export function topEngaged(rows: RecordRow[], by: "likes" | "comments", n = 5): RecordRow[] {
  return rows
    .filter((r) => isDigital(r) && r[by] > 0)
    .sort((a, b) => b[by] - a[by] || b.views - a.views)
    .slice(0, n);
}

export interface PlatformEngage extends EngageTotals {
  platform: string;
}

/** Likes and comments per 1,000 views on each platform that has posts. */
export function platformEngage(rows: RecordRow[]): PlatformEngage[] {
  return ENGAGE_PLATFORMS.map((p) => ({ platform: p, ...engageTotals(rows.filter((r) => r.platform === p)) })).filter((x) => x.posts > 0);
}

export interface TopicEngage extends EngageTotals {
  topicType: string;
}

/** Topic types with at least MIN_TOPIC_POSTS digital posts, most likes + comments first. */
export function topicEngage(rows: RecordRow[]): TopicEngage[] {
  const by = new Map<string, RecordRow[]>();
  for (const r of rows) {
    if (!isDigital(r)) continue;
    const t = r.topicType || "ไม่ระบุประเภท";
    by.set(t, [...(by.get(t) || []), r]);
  }
  return [...by]
    .filter(([, list]) => list.length >= MIN_TOPIC_POSTS)
    .map(([topicType, list]) => ({ topicType, ...engageTotals(list) }))
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments));
}

export interface TalkClip {
  row: RecordRow;
  commentsPer1k: number;
}

/**
 * "คลิปชวนคุย": the clip with the most comments per 1,000 views, among clips with at
 * least the median views of their platform (so a clip with 20 views and 5 comments
 * does not win).
 */
export function talkClip(rows: RecordRow[]): TalkClip | null {
  let best: TalkClip | null = null;
  for (const p of ENGAGE_PLATFORMS) {
    const list = rows.filter((r) => r.platform === p && r.views > 0);
    const mid = median(list.map((r) => r.views));
    for (const r of list) {
      if (r.views < mid || r.comments <= 0) continue;
      const c = (r.comments / r.views) * 1000;
      if (!best || c > best.commentsPer1k) best = { row: r, commentsPer1k: c };
    }
  }
  return best;
}
