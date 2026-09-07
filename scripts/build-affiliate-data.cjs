const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const [outFile, ...files] = process.argv.slice(2);
if (!outFile || files.length !== 4) {
  console.error("Usage: node build-affiliate-data.cjs OUT 2025-content 2025-products 2026-content 2026-products");
  process.exit(1);
}

const value = (row, key) => Number(row[key] || 0);
const isoDate = (raw) => {
  if (!raw) return "";
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
const rows = (file, sheet) => {
  const workbook = XLSX.readFile(file, { cellDates: true });
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: null, raw: true });
};
const inferProgram = (title) => {
  const text = String(title || "").toLowerCase();
  if (text.includes("ถกไม่เถียง")) return "ถกไม่เถียง";
  if (text.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (text.includes("one ลุมพินี") || text.includes("one lumpinee") || (text.includes("one ") && text.includes("full fight"))) return "ONE Lumpinee";
  if (text.includes("ch7hd") || text.includes("ช่อง 7")) return "Ch7HD";
  if (text.includes("kids")) return "Kidsfun";
  if (text.includes("hitz")) return "Hitzradio";
  return "อื่น ๆ";
};
const inferVideoType = (title, duration) => {
  const text = String(title || "").toLowerCase();
  if (text.includes("[live]") || text.includes("🔴") || text.includes(" live ")) return "Live";
  if (Number(duration) > 0 && Number(duration) <= 180) return "Short";
  if (text.includes("full ep") || text.includes("full fight") || Number(duration) >= 1200) return "Full Episode";
  return "Highlight";
};
const inferCategory = (title) => {
  const text = String(title || "").toLowerCase();
  if (/(iphone|ipad|apple|xiaomi|samsung|มือถือ|โทรศัพท์|โน้ตบุ๊ก|laptop|กล้อง|camera|drone|หูฟัง|ลำโพง)/i.test(text)) return "Electronics / IT";
  if (/(ครีม|เซรั่ม|สบู่|แชมพู|ผิว|วิตามิน|อาหารเสริม|สุขภาพ|beauty|skincare|makeup)/i.test(text)) return "Beauty / Health";
  if (/(แอร์|พัดลม|ตู้เย็น|เครื่องซัก|หม้อ|กระทะ|เตียง|โต๊ะ|เก้าอี้|บ้าน|ครัว)/i.test(text)) return "Home / Appliances";
  if (/(กาแฟ|ขนม|อาหาร|น้ำดื่ม|นม|ชา|เครื่องดื่ม)/i.test(text)) return "Food / Beverage";
  if (/(เสื้อ|กางเกง|รองเท้า|กระเป๋า|หมวก|แฟชั่น|นาฬิกา)/i.test(text)) return "Fashion";
  return "Other";
};

const data = { generatedAt: new Date().toISOString(), summary: [], daily: [], contents: [], products: [] };
for (let index = 0; index < files.length; index += 2) {
  const year = index === 0 ? 2025 : 2026;
  const contentFile = files[index];
  const productFile = files[index + 1];
  const contentRows = rows(contentFile, "Table data");
  const productRows = rows(productFile, "Table data");
  const official = contentRows.find((row) => String(row.Content).trim().toLowerCase() === "total") || {};
  const contents = contentRows.filter((row) => row.Content && String(row.Content).trim().toLowerCase() !== "total").map((row) => {
    const revenue = value(row, "Estimated revenue (THB)");
    const sales = value(row, "Total sales (THB)");
    const orders = value(row, "Orders");
    return {
      year,
      contentId: String(row.Content),
      videoTitle: String(row["Video title"] || ""),
      publishDate: isoDate(row["Video publish time"]),
      durationSeconds: value(row, "Duration"),
      program: inferProgram(row["Video title"]),
      videoType: inferVideoType(row["Video title"], row.Duration),
      affiliateRevenue: revenue,
      totalSales: sales,
      orders,
      commissionRate: sales ? revenue / sales : 0,
      avgOrderValue: orders ? sales / orders : 0,
      revenuePerOrder: orders ? revenue / orders : 0,
      url: `https://www.youtube.com/watch?v=${String(row.Content)}`,
      sourceFile: path.basename(contentFile),
    };
  });
  const products = productRows.filter((row) => row.Product && String(row.Product).trim().toLowerCase() !== "total").map((row) => {
    const revenue = value(row, "Estimated revenue (THB)");
    const sales = value(row, "Total sales (THB)");
    const orders = value(row, "Orders");
    return {
      year,
      productId: String(row.Product),
      productTitle: String(row["Product title"] || ""),
      category: inferCategory(row["Product title"]),
      affiliateRevenue: revenue,
      totalSales: sales,
      orders,
      commissionRate: sales ? revenue / sales : 0,
      avgOrderValue: orders ? sales / orders : 0,
      revenuePerOrder: orders ? revenue / orders : 0,
      sourceFile: path.basename(productFile),
    };
  });
  const daily = rows(contentFile, "Totals").filter((row) => row.Date).map((row) => ({
    date: isoDate(row.Date), year, affiliateRevenue: value(row, "Estimated revenue (THB)"), sourceFile: path.basename(contentFile),
  }));
  const officialRevenue = value(official, "Estimated revenue (THB)");
  const officialSales = value(official, "Total sales (THB)");
  const officialOrders = value(official, "Orders");
  const contentListedRevenue = contents.reduce((sum, row) => sum + row.affiliateRevenue, 0);
  const productListedRevenue = products.reduce((sum, row) => sum + row.affiliateRevenue, 0);
  data.summary.push({
    year, affiliateRevenue: officialRevenue, totalSales: officialSales, orders: officialOrders,
    commissionRate: officialSales ? officialRevenue / officialSales : 0,
    avgOrderValue: officialOrders ? officialSales / officialOrders : 0,
    contentRows: contents.length, productRows: products.length,
    contentListedRevenue, productListedRevenue,
    contentRevenueCoverage: officialRevenue ? contentListedRevenue / officialRevenue : 0,
    productRevenueCoverage: officialRevenue ? productListedRevenue / officialRevenue : 0,
  });
  data.contents.push(...contents);
  data.products.push(...products);
  data.daily.push(...daily);
}

data.daily.sort((a, b) => a.date.localeCompare(b.date));
data.contents.sort((a, b) => b.affiliateRevenue - a.affiliateRevenue);
data.products.sort((a, b) => b.affiliateRevenue - a.affiliateRevenue);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(data));
console.log(JSON.stringify({ summary: data.summary, dailyRows: data.daily.length, contentRows: data.contents.length, productRows: data.products.length }, null, 2));
