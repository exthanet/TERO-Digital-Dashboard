import * as XLSX from "xlsx";

export type MonthlyRevenueItem = {
  month: string; // e.g. "2025-09"
  monthLabel: string; // e.g. "Sep 2025"
  year: number; // e.g. 2025
  estRevenue: number;
  partnerAdRevenue: number;
  youtubePremiumRevenue: number;
  affiliateProgramRevenue: number;
  shortsFeedAdsRevenue: number;
  superChatRevenue: number;
  superStickersRevenue: number;
  educationPlayerRevenue: number;
  shoppingAffiliateBonus: number;
};

export type RevenueData = {
  generatedAt: string;
  monthly: MonthlyRevenueItem[];
};

const numVal = (row: Record<string, unknown>, ...keys: string[]): number => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      const v = row[k];
      if (typeof v === "number") return isNaN(v) ? 0 : v;
      const parsed = parseFloat(String(v).replace(/,/g, "").trim());
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

  const str = String(val).trim();

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
    const rawMonth = row["Monthly"] || row["Month"] || row["เดือน"] || row["Date"] || row["date"];
    if (!rawMonth) return;

    const { month, monthLabel, year } = parseMonthYear(rawMonth);
    const estRevenue = numVal(row, "EST.Revenue", "EST. Revenue", "Estimated revenue", "Estimated revenue (THB)", "Revenue", "รายได้รวม");
    const partnerAdRevenue = numVal(row, "Estimated partner ad revenue", "Partner ad revenue", "Watch Page ads", "รายได้จากโฆษณา");
    const youtubePremiumRevenue = numVal(row, "YouTube Premium", "Youtube Premium", "Premium", "พรีเมียม");
    const affiliateProgramRevenue = numVal(row, "Affiliate program", "Affiliate Program", "Affiliate", "แอฟฟิลิเอต");
    const shortsFeedAdsRevenue = numVal(row, "Shorts Feed ads", "Shorts feed ads", "Shorts Feed Ads", "Shorts ads", "โฆษณาช็อตส์");
    const superChatRevenue = numVal(row, "Super Chat", "Super chat", "SuperChat", "ซูเปอร์แชท");
    const superStickersRevenue = numVal(row, "Super Stickers", "Super stickers", "SuperStickers", "ซูเปอร์สติกเกอร์");
    const educationPlayerRevenue = numVal(row, "YouTube Player for Education", "Player for Education", "Education Player");
    const shoppingAffiliateBonus = numVal(row, "Shopping Affiliate bonus", "Shopping Affiliate Bonus", "Shopping bonus", "Shopping Affiliate");

    // If already exists, accumulate or replace
    map.set(month, {
      month,
      monthLabel,
      year,
      estRevenue: estRevenue || (partnerAdRevenue + youtubePremiumRevenue + affiliateProgramRevenue + shortsFeedAdsRevenue + superChatRevenue + superStickersRevenue + educationPlayerRevenue + shoppingAffiliateBonus),
      partnerAdRevenue,
      youtubePremiumRevenue,
      affiliateProgramRevenue,
      shortsFeedAdsRevenue,
      superChatRevenue,
      superStickersRevenue,
      educationPlayerRevenue,
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
