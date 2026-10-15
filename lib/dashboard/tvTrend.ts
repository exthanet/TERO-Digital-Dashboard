// TV Overview Report: how the TV charts group their points, and the episode list.
// Raw ratings and audiences from the TV rows.
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

const isTv = (r: RecordRow) => r.platform === "TV" || r.ratingTotal > 0;

/** Every TV episode with a rating on either channel, newest first (then by program). */
export function tvEpisodes(rows: RecordRow[]): RecordRow[] {
  return rows.filter((r) => isTv(r) && (r.ratingTotal > 0 || r.gmmRating > 0)).sort((a, b) => b.date.localeCompare(a.date) || a.program.localeCompare(b.program));
}
