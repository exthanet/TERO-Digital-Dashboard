// The search box: what it matches and the numbers of the posts it finds
// (รายงาน → ผลการค้นหา). Several terms separated by commas match any of them
// ("buddydean, บัดดี้ดีน"); "#" and letter case do not matter.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";

/** Terms from the box: split on commas, trimmed, lower case, without a leading "#". */
export function searchTerms(text: string): string[] {
  return String(text || "")
    .split(/[,，]/)
    .map((t) => t.trim().replace(/^#+/, "").toLowerCase())
    .filter(Boolean);
}

/** Title, program, channel and hashtags (from the caption / YouTube description). */
const haystack = (r: RecordRow) => `${r.topic} ${r.program} ${r.channel} ${r.hashtags || ""}`.toLowerCase();

/** No terms = everything matches. */
export const matchesSearch = (r: RecordRow, terms: string[]) => !terms.length || terms.some((t) => haystack(r).includes(t));

export interface SearchLine {
  platform: string;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** (likes + comments + shares) ÷ views. */
  er: number;
}

const line = (platform: string, rows: RecordRow[]): SearchLine => {
  const sum = (f: (r: RecordRow) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);
  const views = sum((r) => r.views);
  const likes = sum((r) => r.likes);
  const comments = sum((r) => r.comments);
  const shares = sum((r) => r.shares);
  return { platform, posts: rows.length, views, likes, comments, shares, er: views > 0 ? (likes + comments + shares) / views : 0 };
};

const isTv = (r: RecordRow) => r.platform === "TV";

/** Online posts per platform (most views first) with a total line; TV episodes counted apart. */
export function searchSummary(rows: RecordRow[]): { lines: SearchLine[]; total: SearchLine; tv: { episodes: number; audience: number } } {
  const online = rows.filter((r) => !isTv(r));
  const byPlatform = new Map<string, RecordRow[]>();
  for (const r of online) {
    const list = byPlatform.get(r.platform);
    if (list) list.push(r);
    else byPlatform.set(r.platform, [r]);
  }
  const tv = rows.filter(isTv);
  return {
    lines: [...byPlatform.entries()].map(([p, list]) => line(p, list)).sort((a, b) => b.views - a.views),
    total: line("รวม", online),
    tv: { episodes: tv.length, audience: tv.reduce((a, r) => a + (r.audienceTotal || 0), 0) },
  };
}

/** Online posts per month: posts and views, oldest first. */
export function searchByMonth(rows: RecordRow[]): { month: string; posts: number; views: number; likes: number; comments: number }[] {
  const m = new Map<string, { month: string; posts: number; views: number; likes: number; comments: number }>();
  for (const r of rows) {
    if (isTv(r) || !r.date) continue;
    const k = r.date.slice(0, 7);
    const x = m.get(k) || { month: k, posts: 0, views: 0, likes: 0, comments: 0 };
    x.posts++;
    x.views += r.views || 0;
    x.likes += r.likes || 0;
    x.comments += r.comments || 0;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
}
