// Advanced → การเติบโต → one clip: the same content on every platform, its
// daily gains in the range, how it did against normal and when it was posted.
// Raw numbers only; this file matches posts and adds them up.
//
// There is no shared id across platforms, so posts are matched by title:
// same programme, same title once hashtags are dropped, posted within 3 days.
//
// Relative imports only: tests run this file directly with Node.
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import { postHour } from "./audience.ts";
import type { RecordRow } from "./types.ts";

/** Posts of the same content are posted within this many days of each other. */
export const SIBLING_DAYS = 3;
/** Normal = median views of the same platform + format over this many days before the post. */
const BASELINE_DAYS = 30;
/** Posting hours are compared over this many days before the post. */
const HOUR_DAYS = 90;
/** An hour needs this many clips before its median counts. */
const HOUR_MIN_CLIPS = 3;

export const normTitle = (t: string) =>
  t
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

/** The clip plus its posts on other platforms (same programme and title, within 3 days). */
export function siblingsOf(clip: RecordRow, rows: RecordRow[]): { posts: RecordRow[]; byTitle: boolean } {
  const title = normTitle(clip.topic);
  const ownKey = recordKey(clip);
  if (!title) return { posts: [clip], byTitle: false };
  const seen = new Set<string>([ownKey || clip.url]);
  const posts = [clip];
  for (const r of rows) {
    if (r.platform === "TV" || r.program !== clip.program || !r.date || Math.abs(dayDiff(r.date, clip.date)) > SIBLING_DAYS) continue;
    if (normTitle(r.topic) !== title) continue;
    const k = recordKey(r) || r.url;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    posts.push(r);
  }
  return { posts, byTitle: posts.length > 1 };
}

export interface ClipPost {
  key: string;
  row: RecordRow;
  /** Views / engagement gained in the range (days with data only). */
  gained: number;
  gainedEngagement: number;
  /** Median views of the same platform + format in the 30 days before; null under 3 clips. */
  baseline: number | null;
  index: number | null;
  hour: number | null;
  /** Median views per clip posted in that hour (same platform + format, 90 days before). */
  hourMedian: number | null;
  /** Hour with the highest median in the same group; null when no hour has enough clips. */
  bestHour: { hour: number; median: number } | null;
  /** Every hour 0–23 of the same group: clips posted then and their median (null under HOUR_MIN_CLIPS). */
  hours: { hour: number; clips: number; median: number | null }[];
}

export interface ClipDetail {
  posts: ClipPost[];
  byTitle: boolean;
  totalViews: number;
  likes: number;
  comments: number;
  shares: number;
  /** Engagement ÷ views over the posts that have views. */
  er: number;
  gained: number;
  gainedEngagement: number;
  /** Per day: views gained per platform and the running total in the range. */
  daily: { date: string; hasData: boolean; total: number; cumulative: number; [platform: string]: number | string | boolean }[];
  platforms: string[];
  peak: { date: string; views: number } | null;
  /** Earliest posting day among the posts. */
  firstPosted: string;
  daysWithData: number;
}

export function clipDetail(
  clip: RecordRow,
  allRows: RecordRow[],
  days: Map<string, GrowthEntry[] | null>,
  rangeDays: string[],
): ClipDetail {
  const { posts: rows, byTitle } = siblingsOf(clip, allRows);
  const digital = allRows.filter((r) => r.platform !== "TV" && r.date && r.views > 0);
  const keys = new Map(rows.map((r) => [recordKey(r), r]));

  const gains = new Map<string, { v: number; e: number }>();
  const platforms = new Set<string>();
  const daily: ClipDetail["daily"] = [];
  let cumulative = 0;
  let daysWithData = 0;
  for (const day of rangeDays) {
    const entries = days.get(day);
    const point: ClipDetail["daily"][number] = { date: day, hasData: !!entries, total: 0, cumulative };
    if (entries) {
      daysWithData++;
      for (const [key, v, l, c, s] of entries) {
        const row = keys.get(key);
        if (!row) continue;
        const g = gains.get(key) || { v: 0, e: 0 };
        g.v += v;
        g.e += l + c + s;
        gains.set(key, g);
        platforms.add(row.platform);
        point[row.platform] = Number(point[row.platform] || 0) + v;
        point.total += v;
      }
      cumulative += point.total;
      point.cumulative = cumulative;
    }
    daily.push(point);
  }

  const posts: ClipPost[] = rows.map((row) => {
    const key = recordKey(row);
    const sameGroup = digital.filter((r) => r.platform === row.platform && r.vdoType === row.vdoType && r !== row);
    const before = sameGroup.filter((r) => r.date < row.date && r.date >= addDays(row.date, -BASELINE_DAYS));
    const baseline = before.length >= 3 ? median(before.map((r) => r.views)) : null;

    const hour = postHour(row.publishTime);
    const byHour = new Map<number, number[]>();
    for (const r of sameGroup) {
      if (r.date >= row.date || r.date < addDays(row.date, -HOUR_DAYS)) continue;
      const h = postHour(r.publishTime);
      if (h !== null) byHour.set(h, [...(byHour.get(h) || []), r.views]);
    }
    let bestHour: ClipPost["bestHour"] = null;
    for (const [h, list] of byHour) {
      if (list.length < HOUR_MIN_CLIPS) continue;
      const m = median(list)!;
      if (!bestHour || m > bestHour.median) bestHour = { hour: h, median: m };
    }
    const own = hour === null ? [] : byHour.get(hour) || [];
    const g = gains.get(key) || { v: 0, e: 0 };
    return {
      key,
      row,
      gained: g.v,
      gainedEngagement: g.e,
      baseline,
      index: baseline ? row.views / baseline : null,
      hour,
      hourMedian: own.length >= HOUR_MIN_CLIPS ? median(own) : null,
      bestHour,
      hours: Array.from({ length: 24 }, (_, h) => {
        const list = byHour.get(h) || [];
        return { hour: h, clips: list.length, median: list.length >= HOUR_MIN_CLIPS ? median(list) : null };
      }),
    };
  });
  posts.sort((a, b) => b.row.views - a.row.views);

  const viewed = rows.filter((r) => r.views > 0);
  const viewedViews = viewed.reduce((a, r) => a + r.views, 0);
  let peak: ClipDetail["peak"] = null;
  for (const d of daily) if (d.hasData && d.total > 0 && (!peak || d.total > peak.views)) peak = { date: d.date, views: d.total };

  return {
    posts,
    byTitle,
    totalViews: rows.reduce((a, r) => a + r.views, 0),
    likes: rows.reduce((a, r) => a + r.likes, 0),
    comments: rows.reduce((a, r) => a + r.comments, 0),
    shares: rows.reduce((a, r) => a + r.shares, 0),
    er: viewedViews ? viewed.reduce((a, r) => a + r.engagement, 0) / viewedViews : 0,
    gained: posts.reduce((a, p) => a + p.gained, 0),
    gainedEngagement: posts.reduce((a, p) => a + p.gainedEngagement, 0),
    daily,
    platforms: [...platforms].sort(),
    peak,
    firstPosted: rows.map((r) => r.date).filter(Boolean).sort()[0] || "",
    daysWithData,
  };
}

/** Views gained per platform in the range, most first. */
export function gainedByPlatform(d: ClipDetail): { name: string; total: number }[] {
  const m = new Map<string, number>();
  for (const p of d.posts) m.set(p.row.platform, (m.get(p.row.platform) || 0) + p.gained);
  return [...m.entries()].map(([name, total]) => ({ name, total })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
}

/** Days from the first post to `day` (0 = posting day). */
export const daysAfterPost = (d: ClipDetail, day: string) => (d.firstPosted ? dayDiff(day, d.firstPosted) : null);
