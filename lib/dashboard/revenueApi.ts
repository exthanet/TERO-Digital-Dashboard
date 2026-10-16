// YouTube Revenue: months the revenue file does not have yet, from the YouTube
// Analytics API through the CMS (revenueApi/{YYYY-MM}, written by the daily sync).
// The API gives the total, partner ads and Premium only; every other column of
// the page shows "รอสรุปผล" with the month until the file of that month is imported.
// A month in the file always wins over the API.
//
// Relative imports only: tests run this file directly with Node.
import type { MonthlyRevenueItem } from "./revenueParser.ts";

export interface RevenueApiMonth {
  month: string;
  /** Last day counted (the running month stops at the sync day). */
  endDate: string;
  complete: boolean;
  estRevenue: number;
  partnerAdRevenue: number;
  youtubePremiumRevenue: number;
  updatedAt: string;
}

/** Columns the API does not give: "รอสรุปผล" for an API month. */
export const PENDING_FIELDS = [
  "affiliateProgramRevenue",
  "shortsFeedAdsRevenue",
  "membershipsRevenue",
  "superChatRevenue",
  "superThanksRevenue",
  "giftedMembershipsRevenue",
  "superStickersRevenue",
  "educationPlayerRevenue",
  "shoppingStarBonus",
  "shoppingAffiliateBonus",
] as const;

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-10" → "ต.ค." */
export const thMonth = (month: string) => TH_MONTHS[Number(month.slice(5, 7)) - 1] || month;
/** "2026-10-16" → "16 ต.ค." */
export const thDay = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${thMonth(iso)}` : "");
const enLabel = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export type RevenueItem = MonthlyRevenueItem & { api?: { endDate: string; complete: boolean } };

/** The file's months plus the API months it does not have, sorted. */
export function withApiMonths(file: MonthlyRevenueItem[], api: RevenueApiMonth[]): RevenueItem[] {
  const have = new Set(file.map((m) => m.month));
  const extra: RevenueItem[] = api
    .filter((a) => /^\d{4}-\d{2}$/.test(a.month) && !have.has(a.month) && a.estRevenue > 0)
    .map((a) => ({
      month: a.month,
      monthLabel: enLabel(a.month),
      year: Number(a.month.slice(0, 4)),
      estRevenue: a.estRevenue,
      partnerAdRevenue: a.partnerAdRevenue,
      youtubePremiumRevenue: a.youtubePremiumRevenue,
      ...Object.fromEntries(PENDING_FIELDS.map((f) => [f, 0])),
      api: { endDate: a.endDate, complete: a.complete },
    })) as RevenueItem[];
  return [...file, ...extra].sort((a, b) => a.month.localeCompare(b.month));
}

/** "รอสรุปผล ก.ย., ต.ค." for the API months in a list; "" when there are none. */
export function pendingNote(items: RevenueItem[]): string {
  const months = items.filter((m) => m.api).map((m) => thMonth(m.month));
  return months.length ? `รอสรุปผล ${months.join(", ")}` : "";
}

/** The months a forecast may stand on: a running month (not complete) would pull it down. */
export const forecastBase = (items: RevenueItem[]) => items.filter((m) => !m.api || m.api.complete);
