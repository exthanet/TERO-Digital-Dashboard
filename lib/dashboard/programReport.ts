// รายงาน → รวมรายการ: every program side by side for the report range and the
// filters (platform, VDO type, topic type, search; not the program filter).
// Online posts carry views; TV episodes carry ratings, counted apart.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";
import { parseHashtags } from "./hashtags.ts";
import { CHANNEL_TAGS } from "./trendingHashtags.ts";

export interface Period {
  start: string;
  end: string;
}

/** Programs with fewer posts than this in the range are added up as "อื่นๆ". */
export const MIN_POSTS = 5;
export const OTHERS = "อื่นๆ";

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const inRange = (r: RecordRow, p: Period) => !!r.date && (!p.start || r.date >= p.start) && (!p.end || r.date <= p.end);
const isTv = (r: RecordRow) => r.platform === "TV";
const name = (r: RecordRow) => r.program || "ไม่ระบุ";

export interface ProgramLine {
  program: string;
  /** Programs folded into "อื่นๆ". */
  members: string[];
  posts: number;
  views: number;
  /** Views against the comparison period; null without a base. */
  growth: number | null;
  medianViews: number;
  er: number;
  /** Share of all online views in the range. */
  share: number;
  platforms: Record<string, number>;
  /** Views by publishing month (YYYY-MM → views), for the trend line. */
  monthly: Record<string, number>;
  /** Views by publishing day (YYYY-MM-DD → views), for short ranges. */
  daily: Record<string, number>;
  tv: { episodes: number; rating: number | null; audience: number };
}

function line(program: string, members: string[], online: RecordRow[], tv: RecordRow[], prevViews: number | null, total: number): ProgramLine {
  const views = online.reduce((a, r) => a + r.views, 0);
  const eng = online.reduce((a, r) => a + r.likes + r.comments + r.shares, 0);
  const platforms: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  const daily: Record<string, number> = {};
  for (const r of online) {
    platforms[r.platform] = (platforms[r.platform] || 0) + r.views;
    const m = r.date.slice(0, 7);
    monthly[m] = (monthly[m] || 0) + r.views;
    daily[r.date] = (daily[r.date] || 0) + r.views;
  }
  const rated = tv.filter((r) => r.ratingTotal > 0);
  return {
    program,
    members,
    posts: online.length,
    views,
    growth: prevViews && prevViews > 0 ? (views - prevViews) / prevViews : null,
    medianViews: median(online.map((r) => r.views)),
    er: views > 0 ? eng / views : 0,
    share: total > 0 ? views / total : 0,
    platforms,
    monthly,
    daily,
    tv: {
      episodes: tv.length,
      rating: rated.length ? rated.reduce((a, r) => a + r.ratingTotal, 0) / rated.length : null,
      audience: tv.reduce((a, r) => a + (r.audienceTotal || 0), 0),
    },
  };
}

/** One line per program (most viewed first), small ones folded into "อื่นๆ", and the total. */
export function programTable(rows: RecordRow[], cur: Period, prev: Period | null, minPosts = MIN_POSTS): { lines: ProgramLine[]; total: ProgramLine } {
  const now = rows.filter((r) => inRange(r, cur));
  const online = now.filter((r) => !isTv(r));
  const total = online.reduce((a, r) => a + r.views, 0);
  const prevViews = new Map<string, number>();
  if (prev) for (const r of rows) if (!isTv(r) && inRange(r, prev)) prevViews.set(name(r), (prevViews.get(name(r)) || 0) + r.views);

  const groups = new Map<string, { online: RecordRow[]; tv: RecordRow[] }>();
  for (const r of now) {
    const g = groups.get(name(r)) || { online: [], tv: [] };
    (isTv(r) ? g.tv : g.online).push(r);
    groups.set(name(r), g);
  }
  const big: ProgramLine[] = [];
  const small = { online: [] as RecordRow[], tv: [] as RecordRow[], members: [] as string[], prev: 0 };
  for (const [p, g] of groups) {
    if (g.online.length >= minPosts || g.tv.length > 0) {
      big.push(line(p, [p], g.online, g.tv, prev ? prevViews.get(p) ?? 0 : null, total));
    } else {
      small.online.push(...g.online);
      small.members.push(p);
      small.prev += prevViews.get(p) ?? 0;
    }
  }
  big.sort((a, b) => b.views - a.views || b.tv.audience - a.tv.audience);
  if (small.members.length) big.push(line(OTHERS, small.members.sort(), small.online, [], prev ? small.prev : null, total));
  const allPrev = prev ? [...prevViews.values()].reduce((a, v) => a + v, 0) : null;
  return { lines: big, total: line("รวม", [...groups.keys()], online, now.filter(isTv), allPrev, total) };
}

export interface ProgramDetail {
  top: RecordRow[];
  /** Topic types by median views per post (3+ posts). */
  topics: { topicType: string; posts: number; medianViews: number }[];
  /** Hashtags by views (channel tags left out). */
  hashtags: { tag: string; posts: number; views: number }[];
}

export function programDetail(rows: RecordRow[], members: string[], cur: Period): ProgramDetail {
  const set = new Set(members);
  const list = rows.filter((r) => !isTv(r) && inRange(r, cur) && set.has(name(r)));
  const byTopic = new Map<string, number[]>();
  for (const r of list) {
    const t = r.topicType || "ไม่ระบุ";
    byTopic.set(t, [...(byTopic.get(t) || []), r.views]);
  }
  const tags = new Map<string, { posts: number; views: number }>();
  for (const r of list) {
    for (const t of new Set(parseHashtags(r.hashtags))) {
      if (CHANNEL_TAGS.has(t)) continue;
      const x = tags.get(t) || { posts: 0, views: 0 };
      x.posts++;
      x.views += r.views;
      tags.set(t, x);
    }
  }
  return {
    top: [...list].sort((a, b) => b.views - a.views).slice(0, 5),
    topics: [...byTopic.entries()]
      .filter(([, v]) => v.length >= 3)
      .map(([topicType, v]) => ({ topicType, posts: v.length, medianViews: median(v) }))
      .sort((a, b) => b.medianViews - a.medianViews)
      .slice(0, 5),
    hashtags: [...tags.entries()]
      .filter(([, x]) => x.posts >= 2)
      .map(([tag, x]) => ({ tag, ...x }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
  };
}

/** Months of the range (YYYY-MM), oldest first. */
export function monthsOf(p: Period): string[] {
  const out: string[] = [];
  if (!p.start || !p.end) return out;
  let [y, m] = p.start.slice(0, 7).split("-").map(Number);
  const [ey, em] = p.end.slice(0, 7).split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
