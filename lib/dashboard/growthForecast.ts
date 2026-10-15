// การเติบโต → Case study: how much more a new clip gets after its first day, and for
// how long, learnt from past clips of the same platform + format (growthDaily).
// Every number is checked against what really happened: each past clip is
// predicted from the OTHER clips of its group (leave-one-out).
//
// Relative imports only: tests run this file directly with Node.
import { addDays, recordKey, type GrowthEntry } from "./growth.ts";
import type { RecordRow } from "./types.ts";

/** A group needs this many clips with 7 days before its forecast is shown. */
export const MIN_CLIPS = 30;
/** ... and this many with 10 days for its growth curve and "หมดแรง" day. */
export const MIN_LONG = 20;
/** "หมดแรง": the first day whose gain is under this share of day 1. */
export const FADE_SHARE = 0.05;
/** A day with fewer clips than this share of a usual day was synced short: its gain lands in the next day. */
const SHORT_DAY = 0.5;
const CURVE_DAYS = 10;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
const sum = (a: number[], n: number) => a.slice(0, n).reduce((x, y) => x + y, 0);

export interface GroupStudy {
  key: string;
  platform: string;
  vdoType: string;
  /** Clips with 7 days (forecast) and with 10 days (curve, fade). */
  clips: number;
  longClips: number;
  /** Day-7 total ÷ day 1: median and the middle half. */
  multiplier: number;
  low: number;
  high: number;
  /** Past clips predicted within ±30% of their real day-7 total (0–1), and the usual error. */
  hitRate: number;
  medianError: number;
  /** Median "หมดแรง" day (1 = posting day); null under MIN_LONG clips. */
  fadeDay: number | null;
  /** Median share of the 10-day views reached by day 1…10; [] under MIN_LONG clips. */
  curve: number[];
}

export interface CaseStudy {
  groups: GroupStudy[];
  /** Clips behind the forecast and their posting days. */
  clips: number;
  firstPosted: string;
  lastPosted: string;
  hitRate: number;
  medianError: number;
  /** Days that were synced short (their gain counted with the next day). */
  shortDays: string[];
}

interface Clip {
  key: string;
  group: string;
  platform: string;
  vdoType: string;
  d0: string;
  gains: number[];
}

/** New clips with their daily gains from the day the sync first saw them. */
function newClipsOf(days: Map<string, GrowthEntry[] | null>, rows: RecordRow[]): { clips: Clip[]; shortDays: string[] } {
  const meta = new Map<string, RecordRow>();
  for (const r of rows) {
    if (r.platform === "TV") continue;
    const k = recordKey(r);
    if (k && !meta.has(k)) meta.set(k, r);
  }
  const loaded = [...days.keys()].filter((d) => days.get(d)).sort();
  if (!loaded.length) return { clips: [], shortDays: [] };
  const usual = median(loaded.map((d) => days.get(d)!.length));
  const short = new Set(loaded.filter((d) => days.get(d)!.length < usual * SHORT_DAY));
  const last = loaded[loaded.length - 1];
  const byKey = new Map<string, Map<string, number>>();
  const first = new Map<string, string>();
  for (const d of loaded) {
    for (const [key, views, , , , isNew] of days.get(d)!) {
      if (!byKey.has(key)) byKey.set(key, new Map());
      byKey.get(key)!.set(d, views);
      // The first loaded day calls everything "new": it is only the start of the data.
      if (isNew && d !== loaded[0] && !first.has(key)) first.set(key, d);
    }
  }
  const clips: Clip[] = [];
  for (const [key, d0] of first) {
    if (short.has(d0) || short.has(addDays(d0, 1))) continue;
    const row = meta.get(key);
    if (!row) continue;
    const gains: number[] = [];
    for (let d = d0; d <= last; d = addDays(d, 1)) gains.push(byKey.get(key)!.get(d) ?? 0);
    // A short day and the next: their total spread over both, so day-by-day shapes stay true.
    gains.forEach((_, i) => {
      if (i > 0 && i + 1 < gains.length && short.has(addDays(d0, i))) {
        const t = gains[i] + gains[i + 1];
        gains[i] = t / 2;
        gains[i + 1] = t / 2;
      }
    });
    if (gains[0] > 0) clips.push({ key, group: `${row.platform}|${row.vdoType}`, platform: row.platform, vdoType: row.vdoType, d0, gains });
  }
  return { clips, shortDays: [...short].sort() };
}

export function caseStudy(days: Map<string, GrowthEntry[] | null>, rows: RecordRow[]): CaseStudy {
  const { clips, shortDays } = newClipsOf(days, rows);
  const byGroup = new Map<string, Clip[]>();
  for (const c of clips) byGroup.set(c.group, [...(byGroup.get(c.group) || []), c]);
  const groups: GroupStudy[] = [];
  const allErrors: number[] = [];
  const used: Clip[] = [];
  for (const [key, list] of byGroup) {
    const full = list.filter((c) => c.gains.length >= 7);
    if (full.length < MIN_CLIPS) continue;
    const ratio = (c: Clip) => sum(c.gains, 7) / c.gains[0];
    const ratios = full.map(ratio);
    const errors = full.map((c) => {
      const m = median(full.filter((o) => o !== c).map(ratio));
      const real = sum(c.gains, 7);
      return Math.abs(c.gains[0] * m - real) / real;
    });
    allErrors.push(...errors);
    used.push(...full);
    const long = list.filter((c) => c.gains.length >= CURVE_DAYS);
    const enough = long.length >= MIN_LONG;
    groups.push({
      key,
      platform: full[0].platform,
      vdoType: full[0].vdoType,
      clips: full.length,
      longClips: long.length,
      multiplier: median(ratios),
      low: quantile(ratios, 0.25),
      high: quantile(ratios, 0.75),
      hitRate: errors.filter((e) => e <= 0.3).length / errors.length,
      medianError: median(errors),
      fadeDay: enough
        ? median(
            long.map((c) => {
              const i = c.gains.findIndex((g, j) => j > 0 && g < FADE_SHARE * c.gains[0]);
              return i < 0 ? CURVE_DAYS + 1 : i + 1;
            }),
          )
        : null,
      curve: enough ? Array.from({ length: CURVE_DAYS }, (_, k) => median(long.map((c) => sum(c.gains, k + 1) / sum(c.gains, CURVE_DAYS)))) : [],
    });
  }
  groups.sort((a, b) => b.clips - a.clips);
  const posted = used.map((c) => c.d0).sort();
  return {
    groups,
    clips: used.length,
    firstPosted: posted[0] || "",
    lastPosted: posted[posted.length - 1] || "",
    hitRate: allErrors.length ? allErrors.filter((e) => e <= 0.3).length / allErrors.length : 0,
    medianError: median(allErrors),
    shortDays,
  };
}

export interface ClipForecast {
  expected: number;
  low: number;
  high: number;
  /** Days of growth left (0 = already past the group's usual "หมดแรง" day); null without a fade day. */
  daysLeft: number | null;
  hitRate: number;
}

/** A new clip's day-7 forecast from its first views and its group; null when the group has no study. */
export function forecastClip(study: CaseStudy, row: Pick<RecordRow, "platform" | "vdoType">, firstViews: number, ageDays: number): ClipForecast | null {
  const g = study.groups.find((x) => x.key === `${row.platform}|${row.vdoType}`);
  if (!g || !(firstViews > 0)) return null;
  return {
    expected: firstViews * g.multiplier,
    low: firstViews * g.low,
    high: firstViews * g.high,
    daysLeft: g.fadeDay === null ? null : Math.max(0, g.fadeDay - 1 - ageDays),
    hitRate: g.hitRate,
  };
}
