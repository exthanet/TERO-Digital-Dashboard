// Advanced → การเติบโต → "Evergreen": content posted 2 weeks or more ago that
// still gains views almost every day. Daily gains from growthDaily, added up
// per piece of content across platforms (contentGroups.ts). Raw numbers only.
//
// Relative imports only: tests run this file directly with Node.
import { recordKey, type GrowthEntry } from "./growth.ts";
import { groupContents, type ContentGroup } from "./contentGroups.ts";
import type { RecordRow } from "./types.ts";

/** Younger content is still in its first run of views. */
export const EVERGREEN_MIN_AGE = 14;
/** Share of days with data on which it gained views. */
export const EVERGREEN_MIN_SHARE = 0.8;
/** Average views gained per day. */
export const EVERGREEN_MIN_PER_DAY = 100;
/** Days of data before "every day" means much. */
export const EVERGREEN_FULL_DAYS = 14;

export type AgeBand = "2w-1m" | "1-3m" | "3m+";
export const AGE_BANDS: { key: AgeBand; label: string }[] = [
  { key: "2w-1m", label: "2 สัปดาห์–1 เดือน" },
  { key: "1-3m", label: "1–3 เดือน" },
  { key: "3m+", label: "เกิน 3 เดือน" },
];
export const bandOf = (age: number): AgeBand => (age < 30 ? "2w-1m" : age <= 90 ? "1-3m" : "3m+");

export interface EvergreenItem {
  group: ContentGroup;
  /** Days from the first post to the last day of the range. */
  age: number;
  band: AgeBand;
  daysGaining: number;
  perDay: number;
  total: number;
  /** Second half of the days against the first; null with fewer than 4 days. */
  trend: "up" | "flat" | "down" | null;
  /** Gain per day with data, in order. */
  daily: number[];
  /** Platform with the most views gained in the range. */
  topPlatform: string;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

export function evergreen(
  days: Map<string, GrowthEntry[] | null>,
  rangeDays: string[],
  rows: RecordRow[],
): { items: EvergreenItem[]; daysWithData: number } {
  const dataDays = rangeDays.filter((d) => days.get(d));
  const end = rangeDays[rangeDays.length - 1] || "";
  if (!dataDays.length || !end) return { items: [], daysWithData: 0 };

  const groups = groupContents(rows);
  const groupOf = new Map<string, number>();
  groups.forEach((g, i) => g.posts.forEach((p) => groupOf.set(recordKey(p), i)));
  const platformOf = new Map<string, string>();
  for (const g of groups) for (const p of g.posts) platformOf.set(recordKey(p), p.platform);

  // Gain per group per data day, and per platform over the range.
  const gains = new Map<number, number[]>();
  const byPlatform = new Map<number, Map<string, number>>();
  dataDays.forEach((day, di) => {
    for (const [key, v] of days.get(day) || []) {
      const gi = groupOf.get(key);
      if (gi === undefined) continue;
      const g = gains.get(gi) || new Array(dataDays.length).fill(0);
      g[di] += v;
      gains.set(gi, g);
      const pm = byPlatform.get(gi) || new Map<string, number>();
      const pl = platformOf.get(key)!;
      pm.set(pl, (pm.get(pl) || 0) + v);
      byPlatform.set(gi, pm);
    }
  });

  const items: EvergreenItem[] = [];
  for (const [gi, daily] of gains) {
    const group = groups[gi];
    const age = dayDiff(end, group.date);
    if (age < EVERGREEN_MIN_AGE) continue;
    const total = daily.reduce((a, v) => a + v, 0);
    const perDay = total / dataDays.length;
    const daysGaining = daily.filter((v) => v > 0).length;
    if (daysGaining / dataDays.length < EVERGREEN_MIN_SHARE || perDay < EVERGREEN_MIN_PER_DAY) continue;
    let trend: EvergreenItem["trend"] = null;
    if (daily.length >= 4) {
      const half = Math.floor(daily.length / 2);
      const avg = (xs: number[]) => xs.reduce((a, v) => a + v, 0) / xs.length;
      const first = avg(daily.slice(0, half));
      const second = avg(daily.slice(daily.length - half));
      trend = first <= 0 ? "up" : second / first > 1.15 ? "up" : second / first < 0.85 ? "down" : "flat";
    }
    const pm = [...(byPlatform.get(gi) || new Map()).entries()].sort((a, b) => b[1] - a[1]);
    items.push({ group, age, band: bandOf(age), daysGaining, perDay, total, trend, daily, topPlatform: pm[0]?.[0] || group.lead.platform });
  }
  items.sort((a, b) => b.perDay - a.perDay);
  return { items, daysWithData: dataDays.length };
}

/** Views gained by these items, per Topic Type / programme / format, most first. */
export function evergreenMix(items: EvergreenItem[], field: "topicType" | "program" | "vdoType"): { name: string; total: number; count: number }[] {
  const m = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const k = String(it.group.lead[field] || "ไม่ระบุ");
    const x = m.get(k) || { total: 0, count: 0 };
    x.total += it.total;
    x.count++;
    m.set(k, x);
  }
  return [...m.entries()].map(([name, x]) => ({ name, ...x })).sort((a, b) => b.total - a.total);
}
