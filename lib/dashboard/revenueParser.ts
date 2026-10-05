import * as XLSX from "xlsx";

export type MonthlyRevenueItem = {
  month: string; // e.g. "2026-01"
  monthLabel: string; // e.g. "Jan 2026"
  year: number; // e.g. 2026
  estRevenue: number;
  partnerAdRevenue: number;
  youtubePremiumRevenue: number;
  affiliateProgramRevenue: number;
  shortsFeedAdsRevenue: number;
  membershipsRevenue: number;
  superChatRevenue: number;
  superThanksRevenue: number;
  giftedMembershipsRevenue: number;
  superStickersRevenue: number;
  educationPlayerRevenue: number;
  shoppingStarBonus: number;
  shoppingAffiliateBonus: number;
};

export type RevenueData = {
  generatedAt: string;
  /** Overall (every channel), as the "Overall" sheet gives it. */
  monthly: MonthlyRevenueItem[];
  /** Per company, from their own sheets; absent until a file with those sheets is imported. */
  digital?: MonthlyRevenueItem[];
  entertainment?: MonthlyRevenueItem[];
  /** THB per USD by month ("2026-01"), from the Rate column in the file; absent months have no rate yet. */
  rates?: Record<string, number>;
};

export type RevenueCompany = "digital" | "entertainment";

/** What one import file holds: null = no sheet for it in the file. */
export type RevenueWorkbook = {
  overall: MonthlyRevenueItem[] | null;
  digital: MonthlyRevenueItem[] | null;
  entertainment: MonthlyRevenueItem[] | null;
  /** THB per USD by month, from a table with a "Rate" column (null = none in the file). */
  rates: Record<string, number> | null;
  /** Rate rows that could not be matched to a month. */
  unmatchedRates: number;
  /** Sheets read, in file order, with what each was used for. */
  sheets: { name: string; role: "overall" | RevenueCompany; months: number }[];
};

const numVal = (row: Record<string, unknown>, ...keys: string[]): number => {
  // Normalize row keys for flexible lookup (trim whitespace, remove newlines, remove quotes)
  const normalizedRow: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.replace(/[\r\n"']/g, "").trim().toLowerCase();
    normalizedRow[cleanKey] = v;
  }

  for (const k of keys) {
    const cleanK = k.replace(/[\r\n"']/g, "").trim().toLowerCase();
    const v = normalizedRow[cleanK];
    if (v !== undefined && v !== null && v !== "") {
      if (typeof v === "number") return isNaN(v) ? 0 : v;
      // Strip currency signs like $, ฿, commas, and whitespace
      const cleaned = String(v).replace(/[\$,฿]/g, "").trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 0;
};

const MONTH_NAMES: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
  "ม.ค.": "01",
  "ก.พ.": "02",
  "มี.ค.": "03",
  "เม.ย.": "04",
  "พ.ค.": "05",
  "มิ.ย.": "06",
  "ก.ค.": "07",
  "ส.ค.": "08",
  "ก.ย.": "09",
  "ต.ค.": "10",
  "พ.ย.": "11",
  "ธ.ค.": "12",
};

/** Thai month names: short with or without the final dot ("ก.ย.", "ก.ย") and long ("กันยายน"). */
const THAI_MONTHS: [string[], string][] = [
  [["ม.ค.", "มกราคม"], "01"], [["ก.พ.", "กุมภาพันธ์"], "02"], [["มี.ค.", "มีนาคม"], "03"],
  [["เม.ย.", "เมษายน"], "04"], [["พ.ค.", "พฤษภาคม"], "05"], [["มิ.ย.", "มิถุนายน"], "06"],
  [["ก.ค.", "กรกฎาคม"], "07"], [["ส.ค.", "สิงหาคม"], "08"], [["ก.ย.", "กันยายน"], "09"],
  [["ต.ค.", "ตุลาคม"], "10"], [["พ.ย.", "พฤศจิกายน"], "11"], [["ธ.ค.", "ธันวาคม"], "12"],
];

function monthNumber(name: string): string | null {
  const n = name.trim().toLowerCase();
  const noDot = (x: string) => x.replace(/\.$/, "");
  for (const [names, num] of THAI_MONTHS) if (names.some((x) => noDot(x) === noDot(n))) return num;
  return /^[a-z]{3,}$/.test(n) ? MONTH_NAMES[n.slice(0, 3)] || null : null;
}

const monthLabelOf = (y: number, m: string) =>
  new Date(Date.UTC(y, Number(m) - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const fromBuddhist = (v: string) => {
  const y = parseInt(v, 10);
  return y > 2400 ? y - 543 : y;
};

const result = (y: number, m: string) =>
  Number(m) >= 1 && Number(m) <= 12 ? { month: `${y}-${m}`, monthLabel: monthLabelOf(y, m), year: y } : null;

/**
 * A month cell as "YYYY-MM", or null when it cannot be read (the import then
 * stops instead of saving a wrong month). Accepts Excel date cells, "Sep 2025",
 * "ก.ย. 2568", "2025-09", "09/2025"; Buddhist years are converted.
 */
export function parseMonthYear(val: unknown): { month: string; monthLabel: string; year: number } | null {
  if (val === null || val === undefined || val === "") return null;

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    // Excel date cells can arrive a few seconds early (1 Jan 00:00 → 31 Dec 23:59:56
    // in the Bangkok time zone): round to the nearest hour before reading the month.
    const d = new Date(Math.round(val.getTime() / 3_600_000) * 3_600_000);
    return result(d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"));
  }

  const str = String(val).replace(/[\r\n"']/g, "").trim();

  // "Sep 2025", "September 2025", "ก.ย. 2568", "กันยายน 2568"
  const m1 = str.match(/^([A-Za-zก-๙.]+)\s+(\d{4})$/);
  if (m1) {
    const m = monthNumber(m1[1]);
    return m ? result(fromBuddhist(m1[2]), m) : null;
  }

  // "2025-09", "2025/09", "2025-09-01"
  const m2 = str.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (m2) return result(fromBuddhist(m2[1]), m2[2].padStart(2, "0"));

  // "09/2025", "9-2568"
  const m3 = str.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m3) return result(fromBuddhist(m3[2]), m3[1].padStart(2, "0"));

  return null;
}

export function parseYouTubeRevenueRows(rows: Record<string, unknown>[]): MonthlyRevenueItem[] {
  const map = new Map<string, MonthlyRevenueItem>();
  const unreadable: string[] = [];

  rows.forEach((row) => {
    // Find key for Month/Monthly
    let rawMonth: unknown = null;
    for (const [k, v] of Object.entries(row)) {
      const cleanK = k.replace(/[\r\n"']/g, "").trim().toLowerCase();
      if (["monthly", "month", "เดือน", "date"].includes(cleanK)) {
        rawMonth = v;
        break;
      }
    }
    if (!rawMonth) return;
    if (!(rawMonth instanceof Date) && !String(rawMonth).replace(/[\r\n"']/g, "").trim()) return;

    // Date cells go in as dates: turning them into text first lost the month.
    const parsedMonth = parseMonthYear(rawMonth);
    const estRevenue = numVal(row, "EST.Revenue", "EST. Revenue", "Estimated revenue", "Revenue", "รายได้รวม");
    const partnerAdRevenue = numVal(row, "Estimated partner ad revenue", "Partner ad revenue", "Watch Page ads", "รายได้จากโฆษณา");
    const youtubePremiumRevenue = numVal(row, "YouTube Premium", "Youtube Premium", "Premium", "พรีเมียม");
    const affiliateProgramRevenue = numVal(row, "Affiliate program", "Affiliate Program", "Affiliate", "แอฟฟิลิเอต");
    const shortsFeedAdsRevenue = numVal(row, "Shorts Feed ads", "Shorts feed ads", "Shorts Feed Ads", "Shorts ads", "โฆษณาช็อตส์");
    const membershipsRevenue = numVal(row, "Memberships", "Membership", "สมาชิก");
    const superChatRevenue = numVal(row, "Super Chat", "Super chat", "SuperChat", "ซูเปอร์แชท");
    const superThanksRevenue = numVal(row, "Super Thanks", "Super thanks", "SuperThanks", "ซูเปอร์แต๊งส์");
    const giftedMembershipsRevenue = numVal(row, "Gifted memberships", "Gifted Memberships", "Gifted membership");
    const superStickersRevenue = numVal(row, "Super Stickers", "Super stickers", "SuperStickers", "ซูเปอร์สติกเกอร์");
    const educationPlayerRevenue = numVal(row, "YouTube Player for Education", "Player for Education", "Education Player");
    const shoppingStarBonus = numVal(row, "Shopping Star Bonus", "Shopping Star bonus", "Star bonus", "Star Bonus");
    const shoppingAffiliateBonus = numVal(row, "Shopping Affiliate bonus", "Shopping Affiliate Bonus", "Shopping bonus", "Shopping Affiliate");

    const calculatedTotal =
      partnerAdRevenue +
      youtubePremiumRevenue +
      affiliateProgramRevenue +
      shortsFeedAdsRevenue +
      membershipsRevenue +
      superChatRevenue +
      superThanksRevenue +
      giftedMembershipsRevenue +
      superStickersRevenue +
      educationPlayerRevenue +
      shoppingStarBonus +
      shoppingAffiliateBonus;

    // If month row is completely empty with 0s and no estRevenue, ignore (e.g. empty template rows Oct-Dec)
    if (estRevenue === 0 && calculatedTotal === 0) {
      return;
    }
    if (!parsedMonth) {
      unreadable.push(rawMonth instanceof Date ? rawMonth.toISOString() : String(rawMonth).trim());
      return;
    }
    const { month, monthLabel, year } = parsedMonth;

    map.set(month, {
      month,
      monthLabel,
      year,
      estRevenue: estRevenue || calculatedTotal,
      partnerAdRevenue,
      youtubePremiumRevenue,
      affiliateProgramRevenue,
      shortsFeedAdsRevenue,
      membershipsRevenue,
      superChatRevenue,
      superThanksRevenue,
      giftedMembershipsRevenue,
      superStickersRevenue,
      educationPlayerRevenue,
      shoppingStarBonus,
      shoppingAffiliateBonus,
    });
  });

  if (unreadable.length) {
    throw new Error(
      `อ่านเดือนไม่ได้ ${unreadable.length} แถว: ${unreadable.slice(0, 3).join(", ")} · ใช้รูปแบบเช่น "Sep 2026", "ก.ย. 2569", "2026-09" หรือเซลล์วันที่ (ยังไม่ได้บันทึกอะไร)`,
    );
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}


/**
 * One sheet as rows keyed by its header row, stopping at the first empty row:
 * a second table further down (e.g. the THB conversion under Tero Entertainment)
 * is not monthly revenue.
 */
function sheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return tableAt(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][], 0);
}

/** Rows of the table whose header is grid[at], up to the next empty row. */
function tableAt(grid: unknown[][], at: number): Record<string, unknown>[] {
  const header = (grid[at] || []).map((h) => String(h ?? ""));
  const out: Record<string, unknown>[] = [];
  for (const r of grid.slice(at + 1)) {
    if (r.every((c) => c === null || c === "")) break;
    out.push(Object.fromEntries(header.map((h, i) => [h, r[i] ?? null])));
  }
  return out;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * THB per USD by month from a table with a "Rate" column further down the sheet
 * (the payment table under Tero Entertainment). Its rows carry no month: each is
 * matched to the month whose EST.Revenue it repeats in its first column
 * (e.g. a "Tero Ent" cell of 1200.5 matches the month with EST.Revenue 1,200.498). A "Monthly" column is used when present.
 */
export function ratesFromGrid(grid: unknown[][], months: MonthlyRevenueItem[]): { rates: Record<string, number>; unmatched: number } {
  const rates: Record<string, number> = {};
  let unmatched = 0;
  const at = grid.findIndex((r, i) => i > 0 && r.some((c) => typeof c === "string" && /^\s*rate\s*$/i.test(c)));
  if (at < 0) return { rates, unmatched };
  const header = (grid[at] || []).map((h) => String(h ?? "").trim());
  const rateKey = header.find((h) => /^rate$/i.test(h))!;
  const monthKey = header.find((h) => ["monthly", "month", "เดือน"].includes(h.toLowerCase()));
  const byEst = new Map<number, string[]>();
  for (const m of months) byEst.set(round2(m.estRevenue), [...(byEst.get(round2(m.estRevenue)) || []), m.month]);
  for (const row of tableAt(grid, at)) {
    const rate = Number(row[rateKey]);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    let month: string | null = null;
    if (monthKey) month = parseMonthYear(row[monthKey])?.month || null;
    else {
      const hits = byEst.get(round2(Number(row[header[0]])));
      month = hits && hits.length === 1 ? hits[0] : null;
    }
    if (month) rates[month] = rate;
    else unmatched++;
  }
  return { rates, unmatched };
}

/** Sheet name → what it holds: "Overall …", "… TERO Digital", "… TERO ENTERTAINMENT". */
export function sheetRole(name: string): "overall" | RevenueCompany | null {
  if (/overall/i.test(name)) return "overall";
  if (/digital/i.test(name)) return "digital";
  if (/entertain/i.test(name)) return "entertainment";
  return null;
}

/**
 * A revenue workbook: the Overall sheet and one sheet per company, matched by
 * sheet name. A file without named sheets is read as before (first sheet = overall).
 */
export async function parseRevenueWorkbook(file: File): Promise<RevenueWorkbook> {
  if (file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".txt")) {
    const overall = await parseYouTubeRevenueFile(file);
    return { overall, digital: null, entertainment: null, rates: null, unmatchedRates: 0, sheets: [{ name: file.name, role: "overall", months: overall.length }] };
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const out: RevenueWorkbook = { overall: null, digital: null, entertainment: null, rates: null, unmatchedRates: 0, sheets: [] };
  const named = wb.SheetNames.filter((n) => sheetRole(n));
  const pick = named.length ? named : wb.SheetNames.slice(0, 1);
  for (const name of pick) {
    const role = sheetRole(name) || "overall";
    if (out[role]) continue; // first sheet of each kind wins
    let items: MonthlyRevenueItem[];
    try {
      items = parseYouTubeRevenueRows(sheetRows(wb.Sheets[name]));
    } catch (e) {
      throw new Error(`Sheet "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
    out[role] = items;
    out.sheets.push({ name, role, months: items.length });
    const found = ratesFromGrid(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) as unknown[][], items);
    if (Object.keys(found.rates).length) out.rates = { ...(out.rates || {}), ...found.rates };
    out.unmatchedRates += found.unmatched;
  }
  return out;
}

export async function parseYouTubeRevenueFile(file: File): Promise<MonthlyRevenueItem[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  if (isCsv) {
    const text = await file.text();
    const rows: Record<string, unknown>[] = [];
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error("ไฟล์ CSV ไม่มีข้อมูล");

    // Detect delimiter
    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim());

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, "").trim());
      const row: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        row[h] = parts[idx] ?? "";
      });
      rows.push(row);
    }
    return parseYouTubeRevenueRows(rows);
  }

  // Excel (.xlsx / .xls)
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("ไม่พบ Sheet ในไฟล์ Excel");
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  return parseYouTubeRevenueRows(rows);
}
