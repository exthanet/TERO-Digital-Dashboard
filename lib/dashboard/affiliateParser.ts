import * as XLSX from "xlsx";

export type AffiliateSummary = {
  year: number;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
  commissionRate: number;
  avgOrderValue: number;
  contentRows: number;
  productRows: number;
  contentListedRevenue: number;
  productListedRevenue: number;
  contentRevenueCoverage: number;
  productRevenueCoverage: number;
};

export type AffiliateContent = {
  year: number;
  contentId: string;
  videoTitle: string;
  publishDate: string;
  durationSeconds?: number;
  program: string;
  videoType: string;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
  commissionRate?: number;
  avgOrderValue?: number;
  revenuePerOrder?: number;
  url: string;
  sourceFile?: string;
};

export type AffiliateProduct = {
  year: number;
  productId: string;
  productTitle: string;
  category: string;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
  commissionRate?: number;
  avgOrderValue?: number;
  revenuePerOrder?: number;
  sourceFile?: string;
};

export type AffiliateDaily = {
  date: string;
  year: number;
  affiliateRevenue: number;
  sourceFile?: string;
};

export type AffiliateData = {
  generatedAt: string;
  summary: AffiliateSummary[];
  contents: AffiliateContent[];
  products: AffiliateProduct[];
  daily: AffiliateDaily[];
};

const numVal = (row: Record<string, unknown>, key: string): number => {
  const v = row[key];
  if (typeof v === "number") return v;
  if (!v) return 0;
  const parsed = parseFloat(String(v).replace(/,/g, "").trim());
  return isNaN(parsed) ? 0 : parsed;
};

const isoDate = (raw: unknown): string => {
  if (!raw) return "";
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? "" : raw.toISOString().slice(0, 10);
  }
  const str = String(raw).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Match YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
};

export const inferProgram = (title: string): string => {
  const text = String(title || "").toLowerCase();
  if (text.includes("ถกไม่เถียง")) return "ถกไม่เถียง";
  if (text.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (
    text.includes("one ลุมพินี") ||
    text.includes("one lumpinee") ||
    (text.includes("one ") && text.includes("full fight"))
  )
    return "ONE Lumpinee";
  if (text.includes("ch7hd") || text.includes("ช่อง 7")) return "Ch7HD";
  if (text.includes("kids")) return "Kidsfun";
  if (text.includes("hitz")) return "Hitzradio";
  return "อื่น ๆ";
};

export const inferVideoType = (title: string, duration?: unknown): string => {
  const text = String(title || "").toLowerCase();
  if (text.includes("[live]") || text.includes("🔴") || text.includes(" live "))
    return "Live";
  const dur = Number(duration);
  if (dur > 0 && dur <= 180) return "Short";
  if (text.includes("full ep") || text.includes("full fight") || dur >= 1200)
    return "Full Episode";
  return "Highlight";
};

export const inferCategory = (title: string): string => {
  const text = String(title || "").toLowerCase();
  if (
    /(iphone|ipad|apple|xiaomi|samsung|มือถือ|โทรศัพท์|โน้ตบุ๊ก|laptop|กล้อง|camera|drone|หูฟัง|ลำโพง)/i.test(
      text,
    )
  )
    return "Electronics / IT";
  if (
    /(ครีม|เซรั่ม|สบู่|แชมพู|ผิว|วิตามิน|อาหารเสริม|สุขภาพ|beauty|skincare|makeup)/i.test(
      text,
    )
  )
    return "Beauty / Health";
  if (
    /(แอร์|พัดลม|ตู้เย็น|เครื่องซัก|หม้อ|กระทะ|เตียง|โต๊ะ|เก้าอี้|บ้าน|ครัว)/i.test(
      text,
    )
  )
    return "Home / Appliances";
  if (/(กาแฟ|ขนม|อาหาร|น้ำดื่ม|นม|ชา|เครื่องดื่ม)/i.test(text))
    return "Food / Beverage";
  if (/(เสื้อ|กางเกง|รองเท้า|กระเป๋า|หมวก|แฟชั่น|นาฬิกา)/i.test(text))
    return "Fashion";
  return "Other";
};

/**
 * Parses an Excel / CSV buffer or ArrayBuffer and extracts Affiliate data for a specific year
 */
export async function parseAffiliateFile(
  file: File,
  targetYear: number
): Promise<{
  contents: AffiliateContent[];
  products: AffiliateProduct[];
  daily: AffiliateDaily[];
  officialSummary: { affiliateRevenue: number; totalSales: number; orders: number };
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  let contentRows: Record<string, unknown>[] = [];
  let productRows: Record<string, unknown>[] = [];
  let dailyRows: Record<string, unknown>[] = [];

  // Look for sheets: Table data, Totals, or first sheet
  const sheetNames = workbook.SheetNames;
  const tableDataSheet = sheetNames.find(
    (s) => s.toLowerCase().includes("table data") || s.toLowerCase() === "data"
  );
  const totalsSheet = sheetNames.find((s) => s.toLowerCase().includes("total"));

  if (tableDataSheet) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[tableDataSheet],
      { defval: null, raw: true }
    );
    // Check if it's Content or Product by columns
    const first = rawRows[0] || {};
    if ("Video title" in first || "Content" in first) {
      contentRows = rawRows;
    } else if ("Product title" in first || "Product" in first) {
      productRows = rawRows;
    } else {
      contentRows = rawRows;
    }
  } else if (sheetNames.length > 0) {
    // If only one or multiple arbitrary sheets
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      firstSheet,
      { defval: null, raw: true }
    );
    const first = rawRows[0] || {};
    if ("Product title" in first || "Product" in first) {
      productRows = rawRows;
    } else {
      contentRows = rawRows;
    }
  }

  if (totalsSheet) {
    dailyRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[totalsSheet],
      { defval: null, raw: true }
    );
  }

  // Find official total row
  const officialRow =
    contentRows.find(
      (r) => String(r.Content || "").trim().toLowerCase() === "total"
    ) ||
    productRows.find(
      (r) => String(r.Product || "").trim().toLowerCase() === "total"
    ) ||
    {};

  const officialSummary = {
    affiliateRevenue: numVal(officialRow, "Estimated revenue (THB)") || numVal(officialRow, "Estimated revenue"),
    totalSales: numVal(officialRow, "Total sales (THB)") || numVal(officialRow, "Total sales"),
    orders: numVal(officialRow, "Orders"),
  };

  const parsedContents: AffiliateContent[] = contentRows
    .filter(
      (row) =>
        row.Content &&
        String(row.Content).trim().toLowerCase() !== "total"
    )
    .map((row) => {
      const rev =
        numVal(row, "Estimated revenue (THB)") ||
        numVal(row, "Estimated revenue");
      const sales =
        numVal(row, "Total sales (THB)") || numVal(row, "Total sales");
      const orders = numVal(row, "Orders");
      const videoTitle = String(row["Video title"] || row.Title || "");
      const contentId = String(row.Content || "");
      return {
        year: targetYear,
        contentId,
        videoTitle,
        publishDate: isoDate(row["Video publish time"] || row.Date),
        durationSeconds: numVal(row, "Duration"),
        program: inferProgram(videoTitle),
        videoType: inferVideoType(videoTitle, row.Duration),
        affiliateRevenue: rev,
        totalSales: sales,
        orders,
        commissionRate: sales ? rev / sales : 0,
        avgOrderValue: orders ? sales / orders : 0,
        revenuePerOrder: orders ? rev / orders : 0,
        url: `https://www.youtube.com/watch?v=${contentId}`,
        sourceFile: file.name,
      };
    });

  const parsedProducts: AffiliateProduct[] = productRows
    .filter(
      (row) =>
        row.Product &&
        String(row.Product).trim().toLowerCase() !== "total"
    )
    .map((row) => {
      const rev =
        numVal(row, "Estimated revenue (THB)") ||
        numVal(row, "Estimated revenue");
      const sales =
        numVal(row, "Total sales (THB)") || numVal(row, "Total sales");
      const orders = numVal(row, "Orders");
      const productTitle = String(row["Product title"] || row.Title || "");
      return {
        year: targetYear,
        productId: String(row.Product || ""),
        productTitle,
        category: inferCategory(productTitle),
        affiliateRevenue: rev,
        totalSales: sales,
        orders,
        commissionRate: sales ? rev / sales : 0,
        avgOrderValue: orders ? sales / orders : 0,
        revenuePerOrder: orders ? rev / orders : 0,
        sourceFile: file.name,
      };
    });

  const parsedDaily: AffiliateDaily[] = dailyRows
    .filter((row) => row.Date)
    .map((row) => ({
      date: isoDate(row.Date),
      year: targetYear,
      affiliateRevenue:
        numVal(row, "Estimated revenue (THB)") ||
        numVal(row, "Estimated revenue"),
      sourceFile: file.name,
    }));

  return {
    contents: parsedContents,
    products: parsedProducts,
    daily: parsedDaily,
    officialSummary,
  };
}

/**
 * Merge newly imported year data into existing AffiliateData structure
 */
export function mergeAffiliateData(
  prev: AffiliateData | null,
  year: number,
  contents: AffiliateContent[],
  products: AffiliateProduct[],
  daily: AffiliateDaily[],
  official: { affiliateRevenue: number; totalSales: number; orders: number }
): AffiliateData {
  const existing = prev || {
    generatedAt: new Date().toISOString(),
    summary: [],
    contents: [],
    products: [],
    daily: [],
  };

  // Filter out existing records for this year
  const otherContents = existing.contents.filter((c) => c.year !== year);
  const otherProducts = existing.products.filter((p) => p.year !== year);
  const otherDaily = existing.daily.filter((d) => d.year !== year);
  const otherSummary = existing.summary.filter((s) => s.year !== year);

  const finalContents = (contents.length > 0 ? contents : existing.contents.filter((c) => c.year === year)).slice(0, 500);
  const finalProducts = (products.length > 0 ? products : existing.products.filter((p) => p.year === year)).slice(0, 500);
  const finalDaily = daily.length > 0 ? daily : existing.daily.filter((d) => d.year === year);

  const contentListedRevenue = finalContents.reduce((sum, r) => sum + r.affiliateRevenue, 0);
  const productListedRevenue = finalProducts.reduce((sum, r) => sum + r.affiliateRevenue, 0);

  const officialRev = official.affiliateRevenue || contentListedRevenue;
  const officialSales = official.totalSales || finalContents.reduce((sum, r) => sum + r.totalSales, 0);
  const officialOrders = official.orders || finalContents.reduce((sum, r) => sum + r.orders, 0);

  const yearSummary: AffiliateSummary = {
    year,
    affiliateRevenue: officialRev,
    totalSales: officialSales,
    orders: officialOrders,
    commissionRate: officialSales ? officialRev / officialSales : 0,
    avgOrderValue: officialOrders ? officialSales / officialOrders : 0,
    contentRows: finalContents.length,
    productRows: finalProducts.length,
    contentListedRevenue,
    productListedRevenue,
    contentRevenueCoverage: officialRev ? contentListedRevenue / officialRev : 0,
    productRevenueCoverage: officialRev ? productListedRevenue / officialRev : 0,
  };

  const newSummary = [...otherSummary, yearSummary].sort((a, b) => a.year - b.year);
  const allContents = [...otherContents, ...finalContents].sort((a, b) => b.affiliateRevenue - a.affiliateRevenue);
  const allProducts = [...otherProducts, ...finalProducts].sort((a, b) => b.affiliateRevenue - a.affiliateRevenue);
  const allDaily = [...otherDaily, ...finalDaily].sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAt: new Date().toISOString(),
    summary: newSummary,
    contents: allContents,
    products: allProducts,
    daily: allDaily,
  };
}
