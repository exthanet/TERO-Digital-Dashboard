// TV Overview Report: how the TV charts group their points, and the latest week's
// rating per program and channel. Raw ratings and audiences from the TV rows.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";

export type TvGrain = "day" | "month" | "year";

/** A range longer than one month (31 days) is shown month by month. */
export function autoGrain(start: string, end: string): TvGrain {
  if (!start || !end) return "day";
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  return days > 31 ? "month" : "day";
}

export const grainKey = (date: string, grain: TvGrain) => (grain === "year" ? date.slice(0, 4) : grain === "month" ? date.slice(0, 7) : date);

/** "ก.ย. 69" for "2026-09"; the year as is; a day unchanged. */
export function grainLabel(key: string, grain: TvGrain): string {
  if (grain === "year") return key;
  if (grain === "month") return new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(`${key}-01T00:00:00Z`));
  return key;
}

export interface AudiencePoint {
  date: string;
  ONE31: number;
  GMM25: number;
  /** Episodes behind each channel's point. */
  oneEpisodes: number;
  gmmEpisodes: number;
  topics: string[];
}

/**
 * TV audience per point: a day is that day's total (as before); a month or a year is
 * the average audience per episode, so months with more episodes compare fairly.
 */
export function tvAudienceTrend(rows: RecordRow[], grain: TvGrain): AudiencePoint[] {
  const m = new Map<string, AudiencePoint>();
  for (const r of rows) {
    if (r.platform !== "TV" && !(r.ratingTotal > 0)) continue;
    const key = grainKey(r.date, grain);
    const x = m.get(key) || { date: key, ONE31: 0, GMM25: 0, oneEpisodes: 0, gmmEpisodes: 0, topics: [] };
    x.ONE31 += r.audienceTotal;
    x.GMM25 += r.gmmAudience;
    if (r.audienceTotal > 0) x.oneEpisodes++;
    if (r.gmmAudience > 0) x.gmmEpisodes++;
    if (r.topic && !x.topics.includes(r.topic)) x.topics.push(r.topic);
    m.set(key, x);
  }
  const list = [...m.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(grain === "day" ? -31 : -24);
  if (grain === "day") return list;
  return list.map((x) => ({ ...x, ONE31: x.oneEpisodes ? x.ONE31 / x.oneEpisodes : 0, GMM25: x.gmmEpisodes ? x.GMM25 / x.gmmEpisodes : 0 }));
}

export interface LastWeek {
  /** The 7 days: from the latest aired day with a rating (up to `end`) back 6 days; "" when none. */
  from: string;
  to: string;
  /** Average rating per "program|channel", episodes with a rating only. */
  ratings: Map<string, { rating: number; episodes: number }>;
  /** Every TV episode in those 7 days, newest first. */
  episodes: RecordRow[];
}

const isTv = (r: RecordRow) => r.platform === "TV" || r.ratingTotal > 0;

/** The latest 7 days of TV ratings in the rows: TV files can trail the range end by days. */
export function lastWeekRatings(rows: RecordRow[], end: string): LastWeek {
  const out = new Map<string, { rating: number; episodes: number }>();
  let to = "";
  for (const r of rows) if (isTv(r) && (r.ratingTotal > 0 || r.gmmRating > 0) && (!end || r.date <= end) && r.date > to) to = r.date;
  if (!to) return { from: "", to: "", ratings: out, episodes: [] };
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const last = to;
  const add = (key: string, v: number) => {
    if (!(v > 0)) return;
    const x = out.get(key) || { rating: 0, episodes: 0 };
    x.rating += v;
    x.episodes++;
    out.set(key, x);
  };
  const episodes: RecordRow[] = [];
  for (const r of rows) {
    if (!isTv(r) || r.date < from || r.date > last) continue;
    episodes.push(r);
    add(`${r.program}|One31`, r.ratingTotal);
    add(`${r.program}|GMM25`, r.gmmRating);
  }
  for (const x of out.values()) x.rating /= x.episodes;
  episodes.sort((a, b) => b.date.localeCompare(a.date) || a.program.localeCompare(b.program));
  return { from, to, ratings: out, episodes };
}
