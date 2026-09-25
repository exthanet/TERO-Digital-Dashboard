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
  monthly: MonthlyRevenueItem[];
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

export function parseMonthYear(val: unknown): { month: string; monthLabel: string; year: number } {
  if (!val) {
    const now = new Date();
    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      year: now.getFullYear(),
    };
  }

  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const mLabel = val.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { month: `${y}-${m}`, monthLabel: mLabel, year: y };
  }

  const str = String(val).replace(/[\r\n"']/g, "").trim();

  // Pattern: "Sep 2025" or "Sep 2568"
  const m1 = str.match(/^([A-Za-zก-๙.]+)\s+(\d{4})$/);
  if (m1) {
    const mKey = m1[1].toLowerCase().slice(0, 3);
    const mNum = MONTH_NAMES[mKey] || "01";
    let y = parseInt(m1[2], 10);
    if (y > 2400) y -= 543; // Buddhist year conversion
    return { month: `${y}-${mNum}`, monthLabel: str, year: y };
  }

  // Pattern: "2025-09" or "2025/09"
  const m2 = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (m2) {
    let y = parseInt(m2[1], 10);
    if (y > 2400) y -= 543;
    const mNum = m2[2].padStart(2, "0");
    const dateObj = new Date(y, parseInt(mNum, 10) - 1, 1);
    const mLabel = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { month: `${y}-${mNum}`, monthLabel: mLabel, year: y };
  }

  // Pattern: "09/2025"
  const m3 = str.match(/^(\d{1,2})[-/](\d{4})/);
  if (m3) {
    let y = parseInt(m3[2], 10);
    if (y > 2400) y -= 543;
    const mNum = m3[1].padStart(2, "0");
    const dateObj = new Date(y, parseInt(mNum, 10) - 1, 1);
    const mLabel = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return { month: `${y}-${mNum}`, monthLabel: mLabel, year: y };
  }

  return { month: str, monthLabel: str, year: new Date().getFullYear() };
}

export function parseYouTubeRevenueRows(rows: Record<string, unknown>[]): MonthlyRevenueItem[] {
  const map = new Map<string, MonthlyRevenueItem>();

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

    const rawStr = String(rawMonth).replace(/[\r\n"']/g, "").trim();
    if (!rawStr) return;

    const { month, monthLabel, year } = parseMonthYear(rawStr);
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

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
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
