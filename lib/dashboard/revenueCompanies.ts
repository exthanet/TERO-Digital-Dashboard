// Revenue by company: TERO Digital and Tero Entertainment from their own sheets,
// against the Overall sheet. Numbers stay as the file gives them; these checks
// only point out where the sheets do not add up, for the person importing.
//
// Relative imports only: tests run this file directly with Node.
import type { MonthlyRevenueItem } from "./revenueParser.ts";

type Field = Exclude<keyof MonthlyRevenueItem, "month" | "monthLabel" | "year" | "estRevenue">;

export const REVENUE_FIELDS: { key: Field; label: string }[] = [
  { key: "partnerAdRevenue", label: "Estimated partner ad revenue" },
  { key: "youtubePremiumRevenue", label: "YouTube Premium" },
  { key: "affiliateProgramRevenue", label: "Affiliate program" },
  { key: "shortsFeedAdsRevenue", label: "Shorts Feed ads" },
  { key: "membershipsRevenue", label: "Memberships" },
  { key: "superChatRevenue", label: "Super Chat" },
  { key: "superThanksRevenue", label: "Super Thanks" },
  { key: "giftedMembershipsRevenue", label: "Gifted memberships" },
  { key: "superStickersRevenue", label: "Super Stickers" },
  { key: "educationPlayerRevenue", label: "YouTube Player for Education" },
  { key: "shoppingStarBonus", label: "Shopping Star Bonus" },
  { key: "shoppingAffiliateBonus", label: "Shopping Affiliate bonus" },
];

export const COMPANY_LABEL = { digital: "TERO Digital", entertainment: "Tero Entertainment" } as const;

export type Currency = "USD" | "THB";

/**
 * The months in the chosen currency. THB = USD × that month's rate from the file
 * (before tax); months without a rate are left out and listed in `missing`.
 */
export function inCurrency(
  list: MonthlyRevenueItem[],
  currency: Currency,
  rates: Record<string, number> | undefined,
): { items: MonthlyRevenueItem[]; missing: string[] } {
  if (currency === "USD") return { items: list, missing: [] };
  const items: MonthlyRevenueItem[] = [];
  const missing: string[] = [];
  for (const m of list) {
    const r = rates?.[m.month];
    if (!r) {
      missing.push(m.monthLabel);
      continue;
    }
    const x = { ...m, estRevenue: m.estRevenue * r };
    for (const f of REVENUE_FIELDS) x[f.key] = (m[f.key] || 0) * r;
    items.push(x);
  }
  return { items, missing };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const byMonth = (list: MonthlyRevenueItem[] | null | undefined) => new Map((list || []).map((m) => [m.month, m]));

export interface CompanyMonth {
  month: string;
  monthLabel: string;
  year: number;
  overall: number | null;
  digital: number | null;
  entertainment: number | null;
  /** Overall − both companies, when all three have the month; the part neither company sheet holds. */
  other: number | null;
}

/** EST.Revenue per month for Overall and each company, oldest first. */
export function companyMonths(
  overall: MonthlyRevenueItem[],
  digital: MonthlyRevenueItem[] | undefined,
  entertainment: MonthlyRevenueItem[] | undefined,
): CompanyMonth[] {
  const o = byMonth(overall);
  const d = byMonth(digital);
  const e = byMonth(entertainment);
  const months = [...new Set([...o.keys(), ...d.keys(), ...e.keys()])].sort();
  return months.map((month) => {
    const any = o.get(month) || d.get(month) || e.get(month)!;
    const ov = o.get(month)?.estRevenue ?? null;
    const dv = d.get(month)?.estRevenue ?? null;
    const ev = e.get(month)?.estRevenue ?? null;
    return {
      month,
      monthLabel: any.monthLabel,
      year: any.year,
      overall: ov,
      digital: dv,
      entertainment: ev,
      other: ov !== null && dv !== null && ev !== null ? round2(ov - dv - ev) : null,
    };
  });
}

export interface RevenueChecks {
  /** Months where Overall is not Digital + Entertainment. */
  gaps: { month: string; overall: number; companies: number; gap: number }[];
  /** EST.Revenue differs from the sum of its own columns by more than 0.05. */
  totals: { sheet: string; month: string; est: number; sum: number; diff: number }[];
  /** A column where the companies add up to more than Overall: likely entered in another column. */
  columns: { month: string; label: string; overall: number; companies: number }[];
}

const columnSum = (m: MonthlyRevenueItem) => REVENUE_FIELDS.reduce((a, f) => a + (m[f.key] || 0), 0);

export function revenueChecks(
  overall: MonthlyRevenueItem[] | null,
  digital: MonthlyRevenueItem[] | null,
  entertainment: MonthlyRevenueItem[] | null,
): RevenueChecks {
  const out: RevenueChecks = { gaps: [], totals: [], columns: [] };
  const sheets: [string, MonthlyRevenueItem[] | null][] = [
    ["Overall", overall],
    [COMPANY_LABEL.digital, digital],
    [COMPANY_LABEL.entertainment, entertainment],
  ];
  for (const [sheet, list] of sheets)
    for (const m of list || []) {
      const sum = round2(columnSum(m));
      const diff = round2(m.estRevenue - sum);
      if (Math.abs(diff) > 0.05) out.totals.push({ sheet, month: m.month, est: m.estRevenue, sum, diff });
    }
  if (!overall || !digital || !entertainment) return out;
  const d = byMonth(digital);
  const e = byMonth(entertainment);
  for (const o of overall) {
    const dm = d.get(o.month);
    const em = e.get(o.month);
    if (!dm || !em) continue;
    const companies = round2(dm.estRevenue + em.estRevenue);
    const gap = round2(o.estRevenue - companies);
    if (Math.abs(gap) > 0.05) out.gaps.push({ month: o.month, overall: o.estRevenue, companies, gap });
    for (const f of REVENUE_FIELDS) {
      const c = round2((dm[f.key] || 0) + (em[f.key] || 0));
      if (c - (o[f.key] || 0) > 0.05) out.columns.push({ month: o.month, label: f.label, overall: o[f.key] || 0, companies: c });
    }
  }
  return out;
}
