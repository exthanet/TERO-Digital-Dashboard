// Affiliate (YouTube Shopping) from the three YouTube Studio exports the team keeps
// in Google Sheets: revenue by period (monthly), by content (top 500 videos) and
// by product (top 500 products). Each workbook is told apart by its headers, so
// the order of the links does not matter. Numbers are kept as the export gives
// them; the summary rows ("Total", "Showing top 500 results") are left out.
//
// Relative imports only: tests run this file directly with Node.
import { inferCategory, inferProgram } from "./affiliateParser.ts";

type Row = Record<string, unknown>;
/** A workbook as { tab name: rows (first row = headers) }. */
export type SheetTabs = Record<string, Row[]>;

export interface AffMonth {
  month: string; // "2026-10"
  earnedRevenue: number;
  orders: number;
  totalSales: number;
}
export interface AffDay {
  date: string; // "2026-10-14"
  revenue: number;
}
export interface AffProduct {
  productId: string;
  title: string;
  category: string;
  commission: number;
  totalSales: number;
  orders: number;
}
export interface AffContent {
  contentId: string;
  title: string;
  program: string;
  publishDate: string;
  durationSeconds: number;
  estimatedRevenue: number;
  earnedRevenue: number;
  totalCommission: number;
  removedCommission: number;
  /** In the monthly exports only (0 otherwise). */
  totalSales: number;
  orders: number;
}
export interface AffiliateSheets {
  /** Monthly earned revenue, orders and sales (revenue by period). */
  monthly: AffMonth[];
  /** Daily estimated revenue (the "Totals" tab of the content or product export). */
  daily: AffDay[];
  /** The export over a longer period (not one month). */
  products: AffProduct[];
  contents: AffContent[];
  /** First and last day the long product / content exports cover. */
  productRange: { from: string; to: string };
  contentRange: { from: string; to: string };
  /** Exports of one calendar month, by "YYYY-MM" (the month is read from their days). */
  productsByMonth: Record<string, AffProduct[]>;
  contentsByMonth: Record<string, AffContent[]>;
  /** What each workbook was read as. */
  sources: { kind: "period" | "content" | "product" | "unknown"; tabs: string[]; rows: number; month?: string; from?: string; to?: string }[];
}

const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
/** "Total" and "Showing top 500 results" rows are the export's summary, not data. */
const isSummary = (v: unknown) => /^(total|showing top \d+ results)$/i.test(str(v));
const col = (row: Row, ...names: string[]) => {
  for (const n of names) if (n in row && row[n] !== null && row[n] !== "") return row[n];
  return undefined;
};
const dayOf = (v: unknown) => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
};
const monthOf = (v: unknown) => {
  const s = str(v);
  return /^\d{4}-\d{2}$/.test(s) ? s : /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 7) : "";
};
const tableTab = (tabs: SheetTabs) => Object.keys(tabs).find((t) => /table data/i.test(t)) || Object.keys(tabs)[0];
const totalsTab = (tabs: SheetTabs) => Object.keys(tabs).find((t) => /^totals$/i.test(t.trim()));

export function kindOf(tabs: SheetTabs): "period" | "content" | "product" | "unknown" {
  const first = tabs[tableTab(tabs)]?.[0] || {};
  if ("Product" in first || "Product title" in first) return "product";
  if ("Content" in first || "Video title" in first) return "content";
  if ("Date" in first && ("Orders" in first || "Earned revenue (THB)" in first)) return "period";
  return "unknown";
}

const range = (days: string[]) => {
  const s = days.filter(Boolean).sort();
  return { from: s[0] || "", to: s[s.length - 1] || "" };
};

/** "2026-09" when the days are one whole calendar month (a monthly export); "" otherwise. */
export function monthOfRange(r: { from: string; to: string }): string {
  if (!r.from || r.from.slice(0, 7) !== r.to.slice(0, 7) || !r.from.endsWith("-01")) return "";
  const [y, m] = r.from.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return r.to === last ? r.from.slice(0, 7) : "";
}

const productsOf = (rows: Row[]): AffProduct[] =>
  rows
    .filter((r) => str(r.Product))
    .map((r) => {
      const title = str(r["Product title"]);
      return {
        productId: str(r.Product),
        title,
        category: inferCategory(title),
        commission: num(col(r, "Estimated revenue (THB)", "Estimated revenue")),
        totalSales: num(col(r, "Total sales (THB)", "Total sales")),
        orders: num(r.Orders),
      };
    });

const contentsOf = (rows: Row[]): AffContent[] =>
  rows
    .filter((r) => str(r.Content))
    .map((r) => {
      const title = str(r["Video title"]);
      return {
        contentId: str(r.Content),
        title,
        program: inferProgram(title),
        publishDate: dayOf(r["Video publish time"]) || str(r["Video publish time"]),
        durationSeconds: num(r.Duration),
        estimatedRevenue: num(col(r, "Estimated revenue (THB)", "Estimated revenue")),
        earnedRevenue: num(col(r, "Earned revenue (THB)", "Earned revenue")),
        totalCommission: num(col(r, "Total commission (THB)", "Total commission")),
        removedCommission: num(col(r, "Removed commission (THB)", "Removed commission")),
        totalSales: num(col(r, "Total sales (THB)", "Total sales")),
        orders: num(r.Orders),
      };
    });

/**
 * The exports (any order, any number) → one summary. A product or content export
 * whose days are one calendar month is that month's; any other is the long one.
 */
export function readAffiliateSheets(workbooks: SheetTabs[]): AffiliateSheets {
  const out: AffiliateSheets = {
    monthly: [],
    daily: [],
    products: [],
    contents: [],
    productRange: { from: "", to: "" },
    contentRange: { from: "", to: "" },
    productsByMonth: {},
    contentsByMonth: {},
    sources: [],
  };
  const dailyBy = new Map<string, number>();
  for (const tabs of workbooks) {
    const kind = kindOf(tabs);
    const rows = (tabs[tableTab(tabs)] || []).filter((r) => !isSummary(Object.values(r)[0]));
    const totals = totalsTab(tabs) ? tabs[totalsTab(tabs)!].filter((r) => !isSummary(r.Date)) : [];
    if (kind === "period") {
      out.sources.push({ kind, tabs: Object.keys(tabs), rows: rows.length });
      out.monthly = rows
        .map((r) => ({
          month: monthOf(r.Date),
          earnedRevenue: num(col(r, "Earned revenue (THB)", "Earned revenue")),
          orders: num(r.Orders),
          totalSales: num(col(r, "Total sales (THB)", "Total sales")),
        }))
        .filter((m) => m.month)
        .sort((a, b) => a.month.localeCompare(b.month));
      continue;
    }
    // Daily estimated revenue: every content and product export gives the same "Totals" tab for its days.
    const days = totals.map((r) => ({ date: dayOf(r.Date), revenue: num(col(r, "Estimated revenue (THB)", "Estimated revenue")) })).filter((d) => d.date);
    for (const d of days) dailyBy.set(d.date, d.revenue);
    const span = range(days.map((d) => d.date));
    const month = monthOfRange(span);
    out.sources.push({ kind, tabs: Object.keys(tabs), rows: rows.length, ...span, ...(month ? { month } : {}) });
    if (kind === "product") {
      if (month) out.productsByMonth[month] = productsOf(rows);
      else {
        out.products = productsOf(rows);
        out.productRange = span;
      }
    } else if (kind === "content") {
      if (month) out.contentsByMonth[month] = contentsOf(rows);
      else {
        out.contents = contentsOf(rows);
        out.contentRange = span;
      }
    }
  }
  out.daily = [...dailyBy].map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** The same product (or clip) over several months: one row with the numbers added up. */
function addUp<T extends object>(lists: T[][], idKey: keyof T, sumKeys: (keyof T)[]): T[] {
  const by = new Map<unknown, T>();
  for (const list of lists)
    for (const x of list) {
      const have = by.get(x[idKey]) as Record<keyof T, unknown> | undefined;
      if (!have) by.set(x[idKey], { ...x });
      else for (const k of sumKeys) have[k] = Number(have[k] || 0) + Number(x[k] || 0);
    }
  return [...by.values()];
}

/**
 * Products and clips for the months picked ([] = all): the monthly exports added
 * up when every picked month has one; otherwise the long export, and which months
 * had to fall back to it.
 */
export function listsFor(data: AffiliateSheets, picked: string[]) {
  const pm = data.productsByMonth || {};
  const cm = data.contentsByMonth || {};
  // Months picked: monthly exports only when every picked month has one. All: the long export when there is one.
  const monthsFor = (by: Record<string, unknown>, long: unknown[]) =>
    picked.length ? (picked.every((m) => by[m]) ? picked : []) : long.length ? [] : Object.keys(by).sort();
  const productMonths = monthsFor(pm, data.products);
  const contentMonths = monthsFor(cm, data.contents);
  return {
    products: productMonths.length ? addUp(productMonths.map((m) => pm[m]), "productId", ["commission", "totalSales", "orders"]) : data.products,
    contents: contentMonths.length
      ? addUp(contentMonths.map((m) => cm[m]), "contentId", ["estimatedRevenue", "earnedRevenue", "totalCommission", "removedCommission", "totalSales", "orders"])
      : data.contents,
    productMonths,
    contentMonths,
    /** Picked months without a monthly product export (the long one is shown instead). */
    missing: picked.filter((m) => !pm[m]),
  };
}

export type ProductRank = "orders" | "commission" | "totalSales";
/** Top products: best seller (orders), high commission, high seller (sales); ties by commission. */
export function topProducts(products: AffProduct[], by: ProductRank, n = 10): AffProduct[] {
  return [...products].sort((a, b) => b[by] - a[by] || b.commission - a.commission).slice(0, n);
}

/** Months picked ([] = every month): totals and the commission rate (earned ÷ sales). */
export function monthTotals(monthly: AffMonth[], picked: string[]) {
  const list = picked.length ? monthly.filter((m) => picked.includes(m.month)) : monthly;
  const earnedRevenue = list.reduce((a, m) => a + m.earnedRevenue, 0);
  const orders = list.reduce((a, m) => a + m.orders, 0);
  const totalSales = list.reduce((a, m) => a + m.totalSales, 0);
  return {
    months: list.length,
    earnedRevenue,
    orders,
    totalSales,
    rate: totalSales ? earnedRevenue / totalSales : 0,
    perOrder: orders ? earnedRevenue / orders : 0,
  };
}

// ---------- storage: affiliateSheets/current + one document per month (m_YYYY-MM) ----------

export type AffiliateStoreMain = Omit<AffiliateSheets, "productsByMonth" | "contentsByMonth"> & { readAt?: string; months: string[] };
export type AffiliateStoreMonth = { month: string; products: AffProduct[]; contents: AffContent[] };

/** One Firestore document stays under 1 MiB: each month's 500 products and clips go in their own. */
export function splitForStore(data: AffiliateSheets & { readAt?: string }): { main: AffiliateStoreMain; months: AffiliateStoreMonth[] } {
  const { productsByMonth = {}, contentsByMonth = {}, ...rest } = data;
  const months = [...new Set([...Object.keys(productsByMonth), ...Object.keys(contentsByMonth)])].sort();
  return {
    main: { ...rest, months },
    months: months.map((m) => ({ month: m, products: productsByMonth[m] || [], contents: contentsByMonth[m] || [] })),
  };
}

export function joinFromStore(main: AffiliateStoreMain, months: AffiliateStoreMonth[]): AffiliateSheets & { readAt?: string } {
  const productsByMonth: Record<string, AffProduct[]> = {};
  const contentsByMonth: Record<string, AffContent[]> = {};
  for (const m of months) {
    if (m.products?.length) productsByMonth[m.month] = m.products;
    if (m.contents?.length) contentsByMonth[m.month] = m.contents;
  }
  const { months: _list, ...rest } = main;
  void _list;
  return { ...rest, productsByMonth, contentsByMonth };
}

const sumOf = <T>(list: T[] | undefined, f: (x: T) => number) => (list || []).reduce((a, x) => a + f(x), 0);
const sig = (list: (AffProduct | AffContent)[] | undefined) =>
  `${(list || []).length}:${Math.round(sumOf(list, (x) => ("commission" in x ? x.commission : x.estimatedRevenue + x.earnedRevenue)) * 100)}`;

/** What the sheets would change against what is stored: new or changed months, and changed long exports. */
export function diffAffiliate(current: AffiliateSheets | null, next: AffiliateSheets) {
  const added: string[] = [];
  const changed: string[] = [];
  const months = new Set([...next.monthly.map((m) => m.month), ...Object.keys(next.productsByMonth), ...Object.keys(next.contentsByMonth)]);
  for (const m of [...months].sort()) {
    const a = current?.monthly.find((x) => x.month === m);
    const b = next.monthly.find((x) => x.month === m);
    const inCur = !!a || !!current?.productsByMonth?.[m] || !!current?.contentsByMonth?.[m];
    if (!inCur) {
      added.push(m);
      continue;
    }
    const same =
      JSON.stringify(a || null) === JSON.stringify(b || null) &&
      sig(current?.productsByMonth?.[m]) === sig(next.productsByMonth[m]) &&
      sig(current?.contentsByMonth?.[m]) === sig(next.contentsByMonth[m]);
    if (!same) changed.push(m);
  }
  const longChanged = sig(current?.products) !== sig(next.products) || sig(current?.contents) !== sig(next.contents);
  return { added, changed, longChanged, any: added.length > 0 || changed.length > 0 || longChanged };
}
