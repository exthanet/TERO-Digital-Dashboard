// TV competitor comparison: ถกไม่เถียง's rating against the competitor ratings
// the sync keeps from the TV workbook (tvCompetitors/{sourceId}). Both come
// from the same workbook; nothing is adjusted, only averaged.
//
// Two kinds of competitor rows:
// - "channel": the programme on another channel in the same time slot
//   (competitorChannel = "ช่อง 3", …; the programme changes day to day);
// - "slot": fixed news / talk shows at their own times (competitorChannel = "",
//   program = "โหนกระแส", …).
// Relative imports only: tests run this file directly with Node.

export interface CompetitorRow {
  date: string;
  competitorChannel: string;
  program: string;
  slot: string;
  rating: number;
}

export type CompetitorMode = "channel" | "slot";

export interface CompetitorSeries {
  key: string;
  /** Time slot for "slot" series, e.g. "12.35 - 13.30 น.". */
  slot: string;
}

export interface CompetitorRanking {
  key: string;
  own: boolean;
  avg: number;
  days: number;
  /** Share of days both aired on which ถกไม่เถียง rated higher; null for ถกไม่เถียง itself. */
  winShare: number | null;
}

export const OWN_KEY = "ถกไม่เถียง";

/** Same range as TV check 15 in the sync; anything else is a typo in the workbook (e.g. 1351 for 1.351). */
export const validRating = (v: number) => Number.isFinite(v) && v >= 0 && v <= 30;

/** Competitor rows left out because their rating is outside 0–30, for the notice asking to fix the file. */
export function outOfRange(rows: CompetitorRow[], start: string, end: string): CompetitorRow[] {
  return rows.filter((r) => inRange(r.date, start, end) && !validRating(r.rating));
}

const inRange = (d: string, start: string, end: string) => (!start || d >= start) && (!end || d <= end);

export function seriesOf(rows: CompetitorRow[], mode: CompetitorMode): CompetitorSeries[] {
  const m = new Map<string, string>();
  for (const r of rows) {
    if (!validRating(r.rating)) continue;
    if (mode === "channel" ? !r.competitorChannel : !!r.competitorChannel) continue;
    const key = mode === "channel" ? r.competitorChannel : r.program;
    if (!m.has(key)) m.set(key, r.slot);
  }
  return [...m.entries()].map(([key, slot]) => ({ key, slot }));
}

/**
 * Per period: ถกไม่เถียง's average rating and each competitor's, plus the
 * programme names each competitor channel aired (for the tooltip).
 * `own` maps a day to ถกไม่เถียง's rating that day.
 */
export function competitorTrend(
  rows: CompetitorRow[],
  own: Map<string, number>,
  mode: CompetitorMode,
  start: string,
  end: string,
  grain: "day" | "month",
) {
  const series = seriesOf(rows, mode);
  const keyOf = (r: CompetitorRow) => (mode === "channel" ? r.competitorChannel : r.program);
  const buckets = new Map<string, { sums: Map<string, [number, number]>; programs: Map<string, Set<string>> }>();
  const bucket = (period: string) => {
    let b = buckets.get(period);
    if (!b) buckets.set(period, (b = { sums: new Map(), programs: new Map() }));
    return b;
  };
  const add = (b: ReturnType<typeof bucket>, key: string, v: number) => {
    const s = b.sums.get(key) || [0, 0];
    b.sums.set(key, [s[0] + v, s[1] + 1]);
  };
  for (const [day, v] of own) if (inRange(day, start, end)) add(bucket(grain === "day" ? day : day.slice(0, 7)), OWN_KEY, v);
  for (const r of rows) {
    if (!validRating(r.rating) || !inRange(r.date, start, end) || (mode === "channel" ? !r.competitorChannel : !!r.competitorChannel)) continue;
    const b = bucket(grain === "day" ? r.date : r.date.slice(0, 7));
    add(b, keyOf(r), r.rating);
    if (mode === "channel") {
      const set = b.programs.get(keyOf(r)) || new Set<string>();
      set.add(r.program.replace(/\s+/g, " ").trim());
      b.programs.set(keyOf(r), set);
    }
  }
  const points = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => {
      const p: Record<string, number | string> = { date };
      for (const [k, [sum, n]] of b.sums) p[k] = Math.round((sum / n) * 1000) / 1000;
      for (const [k, set] of b.programs) p[`program:${k}`] = [...set].slice(0, 3).join(" / ");
      return p;
    });
  return { points, series };
}

/** Average rating in the range for ถกไม่เถียง and each competitor, best first, with ถกไม่เถียง's day-by-day win share. */
export function competitorRanking(rows: CompetitorRow[], own: Map<string, number>, mode: CompetitorMode, start: string, end: string): CompetitorRanking[] {
  const ownDays = [...own.entries()].filter(([d]) => inRange(d, start, end));
  const out: CompetitorRanking[] = [];
  if (ownDays.length) {
    out.push({ key: OWN_KEY, own: true, avg: ownDays.reduce((a, [, v]) => a + v, 0) / ownDays.length, days: ownDays.length, winShare: null });
  }
  for (const s of seriesOf(rows, mode)) {
    const list = rows.filter(
      (r) =>
        validRating(r.rating) &&
        inRange(r.date, start, end) &&
        (mode === "channel" ? r.competitorChannel === s.key : !r.competitorChannel && r.program === s.key),
    );
    if (!list.length) continue;
    let both = 0;
    let wins = 0;
    for (const r of list) {
      const o = own.get(r.date);
      if (o === undefined) continue;
      both++;
      if (o > r.rating) wins++;
    }
    out.push({ key: s.key, own: false, avg: list.reduce((a, r) => a + r.rating, 0) / list.length, days: list.length, winShare: both ? wins / both : null });
  }
  return out.sort((a, b) => b.avg - a.avg);
}
