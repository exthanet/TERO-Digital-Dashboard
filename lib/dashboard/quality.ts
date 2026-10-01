// Advanced → คุณภาพคลิป: how much of each clip people watch, and engagement
// rate, per platform. Inputs are the raw API columns (Avg_Watch_Sec,
// Video_Length_Sec, Skip_Rate); nothing here changes them, only adds up.
//
// Numbers are kept per platform on purpose: each platform counts a "view"
// differently, so one combined figure would mislead.
import type { RecordRow } from "./types.ts";

/** Clips below this many views are left out of the best/worst lists. */
export const QUALITY_MIN_VIEWS = 50;

/** Share of the clip watched on average (0.42 = 42%); null when the API gave no watch time. Can pass 1 on looping clips. */
export function watchShare(r: RecordRow): number | null {
  return r.avgWatchSec > 0 && r.videoLengthSec > 0 ? r.avgWatchSec / r.videoLengthSec : null;
}

export interface FormatQuality {
  vdoType: string;
  clips: number;
  /** View-weighted share watched; null = no watch-time data. */
  watched: number | null;
  er: number;
}

export interface PlatformQuality {
  platform: string;
  clips: number;
  views: number;
  /** Engagement over content that has views ÷ views (the KPI card's rule). */
  er: number;
  /** View-weighted share watched; null = this platform has no watch-time data. */
  watched: number | null;
  /** View-weighted average seconds watched. */
  avgWatchSec: number | null;
  /** Clips that carry watch time. */
  watchClips: number;
  /** Instagram Reels: view-weighted % of plays NOT skipped at the start. */
  kept: number | null;
  formats: FormatQuality[];
}

function erOf(rows: RecordRow[]) {
  const views = rows.reduce((a, r) => a + r.views, 0);
  const engaged = rows.filter((r) => r.views > 0).reduce((a, r) => a + r.engagement, 0);
  return views ? engaged / views : 0;
}

function weighted(rows: RecordRow[], value: (r: RecordRow) => number | null) {
  let sum = 0;
  let weight = 0;
  let n = 0;
  for (const r of rows) {
    const v = value(r);
    if (v === null || r.views <= 0) continue;
    sum += v * r.views;
    weight += r.views;
    n++;
  }
  return { value: weight ? sum / weight : null, n };
}

export function platformQuality(rows: RecordRow[]): PlatformQuality[] {
  const byPlatform = new Map<string, RecordRow[]>();
  for (const r of rows) {
    if (r.platform === "TV") continue;
    byPlatform.set(r.platform, [...(byPlatform.get(r.platform) || []), r]);
  }
  return [...byPlatform.entries()]
    .map(([platform, list]) => {
      const watched = weighted(list, watchShare);
      const avg = weighted(list, (r) => (r.avgWatchSec > 0 ? r.avgWatchSec : null));
      const kept = weighted(list, (r) => (r.skipRate === null ? null : 1 - r.skipRate / 100));
      const byFormat = new Map<string, RecordRow[]>();
      for (const r of list) byFormat.set(r.vdoType || "ไม่ระบุ", [...(byFormat.get(r.vdoType || "ไม่ระบุ") || []), r]);
      return {
        platform,
        clips: list.length,
        views: list.reduce((a, r) => a + r.views, 0),
        er: erOf(list),
        watched: watched.value,
        avgWatchSec: avg.value,
        watchClips: watched.n,
        kept: kept.value,
        formats: [...byFormat.entries()]
          .map(([vdoType, f]) => ({ vdoType, clips: f.length, watched: weighted(f, watchShare).value, er: erOf(f) }))
          .sort((a, b) => b.clips - a.clips),
      };
    })
    .sort((a, b) => b.views - a.views);
}

export type QualityMetric = "watched" | "er";

export interface RankedQualityClip {
  row: RecordRow;
  value: number;
  /** value ÷ the median of the same platform + format in these rows; null when too few to compare. */
  index: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Best and worst clips of one platform by share watched or ER, each against its format's median. */
export function rankQuality(rows: RecordRow[], platform: string, metric: QualityMetric, size = 10) {
  const valueOf = (r: RecordRow) => (metric === "watched" ? watchShare(r) : r.views > 0 ? r.engagement / r.views : null);
  const clips = rows
    .filter((r) => r.platform === platform && r.views >= QUALITY_MIN_VIEWS)
    .map((row) => ({ row, value: valueOf(row) }))
    .filter((x): x is { row: RecordRow; value: number } => x.value !== null);
  const medians = new Map<string, number | null>();
  for (const vt of new Set(clips.map((c) => c.row.vdoType))) {
    const group = clips.filter((c) => c.row.vdoType === vt).map((c) => c.value);
    medians.set(vt, group.length >= 5 ? median(group) : null);
  }
  const ranked: RankedQualityClip[] = clips.map((c) => {
    const m = medians.get(c.row.vdoType);
    return { ...c, index: m ? c.value / m : null };
  });
  const sorted = [...ranked].sort((a, b) => b.value - a.value);
  return {
    best: sorted.slice(0, size),
    worst: sorted.length > size ? sorted.slice(-size).reverse() : [],
    total: sorted.length,
  };
}

/** Points for the length × share-watched chart (clips with watch time and enough views). */
export function lengthVsWatched(rows: RecordRow[]) {
  return rows
    .filter((r) => r.platform !== "TV" && r.views >= QUALITY_MIN_VIEWS)
    .map((r) => ({ r, share: watchShare(r) }))
    .filter((x): x is { r: RecordRow; share: number } => x.share !== null)
    .map(({ r, share }) => ({
      platform: r.platform,
      lengthSec: r.videoLengthSec,
      /** log10 of the length: short clips and full episodes fit on one axis. */
      lengthLog: Math.log10(r.videoLengthSec),
      watchedPct: Math.round(share * 1000) / 10,
      views: r.views,
      topic: r.topic,
    }));
}
