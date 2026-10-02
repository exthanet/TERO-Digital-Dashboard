// Audience Report: how people respond to the clips posted in the report range.
// Raw numbers only (views, likes, comments; Facebook post clicks/impressions
// as Metricool reports them); this file only adds them up.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";

export interface AudienceTotals {
  likes: number;
  comments: number;
  views: number;
  /** Comments per 1,000 views, over content that has views. */
  commentsPer1k: number;
  /** Facebook posts with click data: clicks ÷ impressions; null = no click data. */
  ctr: number | null;
  ctrPosts: number;
}

const digital = (rows: RecordRow[]) => rows.filter((r) => r.platform !== "TV");
const hasClicks = (r: RecordRow) => r.platform === "Facebook" && r.clicks !== null && r.impressions > 0;

export function audienceTotals(rows: RecordRow[]): AudienceTotals {
  const d = digital(rows);
  const viewed = d.filter((r) => r.views > 0);
  const views = viewed.reduce((a, r) => a + r.views, 0);
  const ctrRows = d.filter(hasClicks);
  const impressions = ctrRows.reduce((a, r) => a + r.impressions, 0);
  return {
    likes: d.reduce((a, r) => a + r.likes, 0),
    comments: d.reduce((a, r) => a + r.comments, 0),
    views,
    commentsPer1k: views ? (viewed.reduce((a, r) => a + r.comments, 0) / views) * 1000 : 0,
    ctr: impressions ? ctrRows.reduce((a, r) => a + (r.clicks as number), 0) / impressions : null,
    ctrPosts: ctrRows.length,
  };
}

/** Hour 0–23 from "HH:MM" (Bangkok time of posting); null when unknown. */
export function postHour(t: string): number | null {
  const m = t.match(/^(\d{1,2}):\d{2}/);
  const h = m ? Number(m[1]) : NaN;
  return h >= 0 && h <= 23 ? h : null;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface HourPoint {
  hour: string;
  clips: number;
  /** Median views per clip posted in that hour. */
  medianViews: number;
  /** Total views per platform, keyed by platform name. */
  [platform: string]: number | string;
}

/** Views by the hour the clip was posted (all 24 hours), plus how many clips have a posting time. */
export function viewsByPostHour(rows: RecordRow[]): { points: HourPoint[]; platforms: string[]; withTime: number; total: number } {
  const d = digital(rows).filter((r) => r.views > 0);
  const byHour = new Map<number, RecordRow[]>();
  for (const r of d) {
    const h = postHour(r.publishTime);
    if (h !== null) byHour.set(h, [...(byHour.get(h) || []), r]);
  }
  const platforms = [...new Set(d.map((r) => r.platform))];
  const totals = new Map(platforms.map((p) => [p, d.filter((r) => r.platform === p).reduce((a, r) => a + r.views, 0)]));
  platforms.sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0));
  const points: HourPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const list = byHour.get(h) || [];
    const p: HourPoint = { hour: `${String(h).padStart(2, "0")}:00`, clips: list.length, medianViews: median(list.map((r) => r.views)) };
    for (const pl of platforms) p[pl] = list.filter((r) => r.platform === pl).reduce((a, r) => a + r.views, 0);
    points.push(p);
  }
  return { points, platforms, withTime: [...byHour.values()].reduce((a, l) => a + l.length, 0), total: d.length };
}

export interface PlatformEngagement {
  platform: string;
  likes: number;
  comments: number;
  views: number;
  commentsPer1k: number;
}

export function engagementByPlatform(rows: RecordRow[]): PlatformEngagement[] {
  const d = digital(rows);
  return [...new Set(d.map((r) => r.platform))]
    .map((platform) => {
      const t = audienceTotals(d.filter((r) => r.platform === platform));
      return { platform, likes: t.likes, comments: t.comments, views: t.views, commentsPer1k: t.commentsPer1k };
    })
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments));
}

/** Facebook post CTR per period ("YYYY-MM-DD" or "YYYY-MM") and the posts clicked most. */
export function facebookCtr(rows: RecordRow[], grain: "day" | "month") {
  const list = digital(rows).filter(hasClicks);
  const m = new Map<string, { clicks: number; impressions: number }>();
  for (const r of list) {
    const k = grain === "day" ? r.date : r.date.slice(0, 7);
    const x = m.get(k) || { clicks: 0, impressions: 0 };
    x.clicks += r.clicks as number;
    x.impressions += r.impressions;
    m.set(k, x);
  }
  const trend = [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, x]) => ({ date, ctr: Math.round((x.clicks / x.impressions) * 10000) / 100, clicks: x.clicks }));
  const top = [...list].sort((a, b) => (b.clicks as number) - (a.clicks as number)).slice(0, 5);
  return { trend, top, posts: list.length };
}
