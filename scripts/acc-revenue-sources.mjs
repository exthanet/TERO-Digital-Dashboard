// ACC report: the month's YouTube earnings workbook, on this PC.
//
//   node scripts/acc-revenue-sources.mjs "C:\Users\...\ACC Report\2026\09"
//
// Reads, in that month's folder:
//   Report Earning - Youtube - YYYY MM.xlsx      the workbook (never overwritten), or, when the
//                                                month has none yet: the latest other month's
//                                                workbook as a template + the dashboard export below
//   Monthly-ACC-YYYY-MM-USD.xlsx                 รายได้ → Monthly ACC → Export (USD), template only
//   Revenue source <start>_<end> <channel>.zip   one per channel (Table data.csv)
//   Channel ... CMS.zip (optional)               channel titles → IDs, to match rows by ID
// Writes "Report Earning - Youtube - YYYY MM (generated).xlsx" next to them:
//   rows 7–30 (template only)  C–L from the dashboard export; what is typed by hand each month
//            (M5 rate, N5 W/T, AdSense, bank charges, B53:B63) is emptied and marked yellow
//   F53:P76  each channel's revenue by source (as in the file; "-" without a file);
//            P (Gifted memberships) is added when the workbook does not have it yet
//   Q53:R76  the export's own Total (sources overlap, so it is not their sum), and
//            Ad + Premium against the table above (K+L)
//   Summary  links to the month sheet again (it held #REF!); O30 uses $M$31 like the other rows
//
// Real revenue: the workbooks and the exports stay on this PC, never in the repo.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { EXPORT_COLUMNS, SOURCE_COLUMNS, matchRow, monthLabels, parseCmsChannels, parseSourceTable, parseZipName } from "../lib/dashboard/revenueSources.ts";

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('ใช้: node scripts/acc-revenue-sources.mjs "<โฟลเดอร์เดือน เช่น ...\\ACC Report\\2026\\09>"');
  process.exit(1);
}
const BOOK = /^Report Earning - Youtube - (\d{4}) (\d{2})\.xlsx$/i;
const files = fs.readdirSync(dir);
const folderMonth = path.basename(path.resolve(dir));
const folderYear = path.basename(path.dirname(path.resolve(dir)));
const report = [];
let book = files.find((f) => BOOK.test(f));
let template = null;
if (!book) {
  // No workbook for this month yet: the latest other month's workbook is the template.
  if (!/^\d{2}$/.test(folderMonth) || !/^\d{4}$/.test(folderYear)) {
    console.error("ไม่พบไฟล์ Report Earning - Youtube - YYYY MM.xlsx และชื่อโฟลเดอร์ไม่ใช่ ...\\YYYY\\MM");
    process.exit(1);
  }
  const parent = path.dirname(path.resolve(dir));
  template = fs
    .readdirSync(parent)
    .filter((d) => /^\d{2}$/.test(d) && d !== folderMonth)
    .flatMap((d) => fs.readdirSync(path.join(parent, d)).filter((f) => BOOK.test(f)).map((f) => path.join(parent, d, f)))
    .sort()
    .pop();
  if (!template) {
    console.error("ไม่พบไฟล์ Report Earning ของเดือนอื่นที่จะใช้เป็นแม่แบบ");
    process.exit(1);
  }
  book = `Report Earning - Youtube - ${folderYear} ${folderMonth}.xlsx`;
  report.push(`ใช้ไฟล์แม่แบบ: ${path.relative(parent, template)}`);
}
const [, year, month] = book.match(BOOK);
const monthStart = `${year}-${month}-01`;

/** First CSV in the zip whose name matches. */
async function csvFrom(zipPath, name) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const entry = Object.values(zip.files).find((f) => !f.dir && path.basename(f.name) === name);
  return entry ? entry.async("string") : null;
}

// The CMS channel export ("Channel … CMS.zip"): titles → channel IDs, and its Total row.
const CHANNEL_CMS = /^Channel .*CMS\.zip$/i;
const cmsZip = files.find((f) => CHANNEL_CMS.test(f));
const cms = cmsZip ? parseCmsChannels((await csvFrom(path.join(dir, cmsZip), "Table data.csv")) || "") : new Map();
if (!cmsZip) {
  // Channel IDs do not change month to month: take them from another month's export.
  const parent = path.dirname(path.resolve(dir));
  const other = fs
    .readdirSync(parent)
    .filter((d) => /^\d{2}$/.test(d) && d !== folderMonth && fs.statSync(path.join(parent, d)).isDirectory())
    .flatMap((d) => fs.readdirSync(path.join(parent, d)).filter((f) => CHANNEL_CMS.test(f)).map((f) => path.join(parent, d, f)))
    .sort()
    .pop();
  if (other) {
    for (const [k, v] of parseCmsChannels((await csvFrom(other, "Table data.csv")) || "")) cms.set(k, v);
    report.push(`ไม่มีไฟล์ Channel … CMS.zip ในโฟลเดอร์นี้: ใช้ Channel ID จาก ${path.relative(parent, other)} (ID ไม่เปลี่ยนตามเดือน)`);
  } else report.push("ไม่มีไฟล์ Channel … CMS.zip: จับคู่ช่องด้วยชื่อเท่านั้น");
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(template || path.join(dir, book));
const sheet = wb.worksheets.find((w) => /^Report_/i.test(w.name));
if (!sheet) throw new Error("ไม่พบแท็บ Report_<เดือน> ในไฟล์");

const text = (v) => (v && typeof v === "object" ? (v.richText ? v.richText.map((t) => t.text).join("") : v.result ?? v.text ?? "") : (v ?? "")).toString().trim();
const num = (v) => {
  const x = v && typeof v === "object" ? v.result : v;
  return typeof x === "number" ? x : 0;
};
/** Yellow = typed by hand for this month. A new style object: cells share theirs. */
const mark = (cell) => {
  cell.value = null;
  cell.style = { ...cell.style, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2A8" } } };
};

if (template) {
  // The dashboard's Monthly ACC export for this month (USD).
  const exportFile = files.find((f) => /^Monthly-ACC-.*USD\.xlsx$/i.test(f));
  if (!exportFile) {
    console.error(`ไม่พบไฟล์ Monthly-ACC-${year}-${month}-USD.xlsx (รายได้ → Monthly ACC → Export แบบ USD)`);
    process.exit(1);
  }
  const ex = new ExcelJS.Workbook();
  await ex.xlsx.readFile(path.join(dir, exportFile));
  const exSheet = ex.getWorksheet(`${year}-${month}`);
  if (!exSheet) throw new Error(`ไฟล์ ${exportFile} ไม่มีแท็บ ${year}-${month}`);
  const head = exSheet.getRow(1).values.map((v) => text(v));
  const col = (h) => head.indexOf(h);
  for (const h of ["Channel Display Name", ...EXPORT_COLUMNS]) if (col(h) < 0) throw new Error(`ไฟล์ ${exportFile} ไม่มีคอลัมน์ "${h}"`);
  const byName = new Map();
  exSheet.eachRow((row, r) => {
    if (r > 1) byName.set(text(row.getCell(col("Channel Display Name")).value), row);
  });

  const labels = monthLabels(year, month);
  sheet.name = labels.sheet;
  sheet.getCell("N4").value = labels.header;
  let fromExport = 0;
  for (let r = 7; r <= 30; r++) {
    const name = text(sheet.getCell(r, 1).value);
    const row = byName.get(name);
    const note = row && col("หมายเหตุ") > 0 ? text(row.getCell(col("หมายเหตุ")).value) : "";
    const hasNumbers = !!row && EXPORT_COLUMNS.some((h) => typeof row.getCell(col(h)).value === "number");
    if (!hasNumbers) {
      // Not in the connected CMS (the export's note says so): typed by hand, as before.
      for (let c = 3; c <= 12; c++) mark(sheet.getCell(r, c));
      report.push(`แถว ${r} ${name}: ${note || "ไม่มีในไฟล์ export"} — ต้องกรอกเอง (สีเหลือง)`);
      continue;
    }
    EXPORT_COLUMNS.forEach((h, i) => {
      const v = row.getCell(col(h)).value;
      sheet.getCell(r, 3 + i).value = typeof v === "number" ? v : null;
    });
    fromExport++;
  }
  // THB at this month's rate (M5) instead of last month's number written into the formula.
  for (let r = 7; r <= 30; r++) {
    const q = sheet.getCell(r, 17);
    if (q.formula && /^P\d+\*[\d.]+$/.test(q.formula)) q.value = { formula: `P${r}*$M$5` };
  }
  report.push(`แถว 7–30: ใส่จาก ${exportFile} ${fromExport} ช่อง`);
  for (const a of ["M5", "N5", "B35", "B36", "B42", "B44", "B48"]) mark(sheet.getCell(a));
  report.push("ต้องกรอกเองเดือนนี้ (สีเหลือง): M5 อัตราแลกเปลี่ยน, N5 W/T รวม, B35–B36 AdSense, B42 Withholding, B44 Bank charge, B48 Processing fee");
}

// Check the block is where it was built: row 52 holds the source names in F–P. A column
// added later (P) may still be missing: it gets its heading and the look of column O.
const LAST = 6 + SOURCE_COLUMNS.length - 1;
SOURCE_COLUMNS.forEach((s, i) => {
  const cell = sheet.getCell(52, 6 + i);
  const head = text(cell.value);
  const wasOurs = /^Total ตามไฟล์ Studio|^Ad + Premium/.test(head);
  if ((!head || wasOurs) && 6 + i > 15) {
    cell.value = s;
    cell.style = { ...sheet.getCell(52, 15).style };
    for (let r = 53; r <= 76; r++) sheet.getCell(r, 6 + i).style = { ...sheet.getCell(r, 15).style };
    sheet.getColumn(6 + i).width = sheet.getColumn(15).width;
    return;
  }
  if (!head.toLowerCase().startsWith(s.toLowerCase().slice(0, 20))) throw new Error(`แถว 52 คอลัมน์ ${String.fromCharCode(70 + i)} ควรเป็น "${s}" แต่เป็น "${head}"`);
});
// The all-channel table on the left (A52:B…) gets a row for the added source too.
SOURCE_COLUMNS.forEach((s) => {
  for (let r = 53; r <= 70; r++) {
    const label = text(sheet.getCell(r, 1).value);
    if (label.toLowerCase() === s.toLowerCase()) return;
    if (!label) {
      sheet.getCell(r, 1).value = s;
      sheet.getCell(r, 1).style = { ...sheet.getCell(r - 1, 1).style };
      sheet.getCell(r, 2).style = { ...sheet.getCell(r - 1, 2).style };
      return;
    }
  }
});

const rows = [];
for (let r = 53; r <= 76; r++) {
  const name = text(sheet.getCell(r, 4).value);
  if (name) rows.push({ row: r, name, id: text(sheet.getCell(r, 5).value) });
}
// The table above (rows 7–30): Ads + Premium per channel name.
const upper = new Map();
for (let r = 7; r <= 30; r++) upper.set(text(sheet.getCell(r, 1).value), { row: r, adsPremium: num(sheet.getCell(r, 11).value) + num(sheet.getCell(r, 12).value) });

const filled = new Set();
const totals = new Map();
/** A "Revenue source" export of the whole CMS account (its name says CMS), for A53:B63. */
let accountSources = null;
for (const f of files) {
  const z = parseZipName(f);
  if (!z) continue;
  if (/\bCMS\b/i.test(z.channel)) {
    if (z.start !== monthStart) report.push(`เตือน: ${f} เป็นช่วง ${z.start} ถึง ${z.end} ไม่ใช่เดือน ${year}-${month}`);
    accountSources = parseSourceTable((await csvFrom(path.join(dir, f), "Table data.csv")) || "");
    report.push(`ตารางซ้าย A52:B ← ${f} (Revenue source ทั้ง CMS)`);
    continue;
  }
  const m = matchRow(z.channel, rows, cms);
  if (!m) {
    report.push(`ไม่พบแถวของช่อง "${z.channel}" (${f}) — ไม่ได้ใส่`);
    continue;
  }
  if (filled.has(m.row.row)) {
    report.push(`ช่อง "${z.channel}" ซ้ำกับแถว ${m.row.row} — ใช้ไฟล์แรก`);
    continue;
  }
  if (z.start !== monthStart) report.push(`เตือน: ${f} เป็นช่วง ${z.start} ถึง ${z.end} ไม่ใช่เดือน ${year}-${month}`);
  const table = parseSourceTable((await csvFrom(path.join(dir, f), "Table data.csv")) || "");
  const known = new Set(["Total", ...SOURCE_COLUMNS]);
  const extra = Object.keys(table).filter((k) => !known.has(k));
  if (extra.length) report.push(`เตือน: ${z.channel} มีประเภทรายได้ที่ไม่มีคอลัมน์ (${extra.join(", ")}) — ไม่ได้ใส่`);
  SOURCE_COLUMNS.forEach((s, i) => {
    sheet.getCell(m.row.row, 6 + i).value = s in table ? table[s] : null;
  });
  filled.add(m.row.row);
  if ("Total" in table) totals.set(m.row.row, table.Total);
  report.push(`แถว ${m.row.row} ${m.row.name} ← ${z.channel} (จับคู่ด้วย ${m.by === "id" ? "Channel ID" : "ชื่อ"})`);
}
for (const r of rows) {
  if (filled.has(r.row)) continue;
  SOURCE_COLUMNS.forEach((_, i) => {
    sheet.getCell(r.row, 6 + i).value = "-";
  });
}

// A53:B63, all channels by source. From the CMS-wide Revenue source export when there is
// one. Without it (a month built from the template): Total = the CMS channel export's
// Total row, each source = the sum of the channel rows on the right (F–O, 53–76).
if (accountSources || template) {
  const cmsTotal = cmsZip
    ? Number(
        ((await csvFrom(path.join(dir, cmsZip), "Table data.csv")) || "")
          .split(/\r?\n/)
          .find((l) => l.startsWith("Total,"))
          ?.split(",")
          .pop(),
      )
    : NaN;
  for (let r = 53; r <= 53 + SOURCE_COLUMNS.length; r++) {
    const label = text(sheet.getCell(r, 1).value);
    if (!label) continue;
    const cell = sheet.getCell(r, 2);
    const i = SOURCE_COLUMNS.findIndex((s) => s.toLowerCase() === label.toLowerCase());
    if (accountSources) cell.value = label in accountSources ? accountSources[label] : null;
    else if (label === "Total" && Number.isFinite(cmsTotal)) cell.value = cmsTotal;
    else if (label === "Total") mark(cell);
    else if (i >= 0) cell.value = { formula: `SUM(${String.fromCharCode(70 + i)}53:${String.fromCharCode(70 + i)}76)` };
    else mark(cell);
  }
  if (!accountSources) {
    sheet.getCell("C52").value = `Total จาก ${cmsZip || "-"} · ประเภทอื่น = ผลรวมตารางรายช่อง (F–${String.fromCharCode(64 + LAST)} แถว 53–76)`;
    report.push(`B53 Total ← ${cmsZip || "(ไม่มีไฟล์ CMS: ต้องกรอกเอง)"} · B54–B63 = ผลรวมจากตารางรายช่อง (ไม่มีไฟล์ Revenue source ทั้ง CMS)`);
  }
}

// P: the export's Total as is (YouTube Studio's sources overlap: their sum is not the total).
// Q: Ad + Premium against the table above. TERO Digital's channel is split above into
// TERO Digital + ถกไม่เถียง + เงินทองของจริง, so it is compared with all three.
const SPLIT = ["TERO Digital", "ถกไม่เถียง", "เงินทองของจริง"];
sheet.getCell(52, LAST + 1).value = "Total ตามไฟล์ Studio (USD)";
sheet.getCell(52, LAST + 2).value = "Ad + Premium − ตารางบน (USD)";
for (const r of rows) {
  if (!filled.has(r.row)) continue;
  sheet.getCell(r.row, LAST + 1).value = totals.get(r.row) ?? null;
  const names = r.name === "TERO Digital" ? SPLIT : [r.name];
  const ups = names.map((n) => upper.get(n)).filter(Boolean);
  if (ups.length === names.length) sheet.getCell(r.row, LAST + 2).value = { formula: `F${r.row}+G${r.row}-(${ups.map((u) => `K${u.row}+L${u.row}`).join("+")})` };
}
// Widths only: the cells keep the sheet's number format (setting numFmt here would also
// change every cell that shares the style).
for (const c of [LAST + 1, LAST + 2]) sheet.getColumn(c).width = Math.max(sheet.getColumn(c).width || 0, 22);

// Fixes asked for: O30 like the other rows; Summary back on the month sheet.
const o30 = sheet.getCell("O30");
if (o30.formula && !o30.formula.includes("$M$31")) {
  o30.value = { formula: "M30*3/$M$31" };
  report.push("แก้ O30 เป็น =M30*3/$M$31 (เดิมใช้ตัวเลขตายตัว)");
}
const summary = wb.getWorksheet("Summary");
if (summary) {
  let linked = 0;
  for (let r = 2; r <= 25; r++) {
    const name = text(summary.getCell(r, 1).value);
    const src = r + 5;
    if (name !== text(sheet.getCell(src, 1).value)) {
      report.push(`Summary แถว ${r} "${name}" ไม่ตรงกับ ${sheet.name} แถว ${src} — ไม่ได้แก้แถวนี้`);
      continue;
    }
    for (let c = 2; c <= 16; c++) {
      const col = String.fromCharCode(64 + c + 1);
      summary.getCell(r, c).value = { formula: `'${sheet.name}'!${col}${src}` };
    }
    linked++;
  }
  report.push(`Summary: เชื่อมไปที่ ${sheet.name} ${linked} แถว`);
}

sheet.getCell("A51").value = `Revenue source จาก YouTube Studio (${files.filter(parseZipName).length} ไฟล์) · สร้างด้วย scripts/acc-revenue-sources.mjs เมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;
// Formulas keep only themselves: the saved results are the template's (or the old
// inputs'), and a viewer that does not recalculate would show them as this month's.
wb.eachSheet((ws) =>
  ws.eachRow((row) =>
    row.eachCell((cell) => {
      const v = cell.value;
      if (!v || typeof v !== "object") return;
      if (v.sharedFormula) cell.value = { sharedFormula: v.sharedFormula };
      else if (v.formula) cell.value = { formula: v.formula, ...(v.ref ? { ref: v.ref, shareType: v.shareType } : {}) };
    }),
  ),
);
wb.calcProperties.fullCalcOnLoad = true;
const out = path.join(dir, book.replace(/\.xlsx$/i, " (generated).xlsx"));
await wb.xlsx.writeFile(out);
console.log(report.join("\n"));
console.log(`\nใส่ข้อมูล ${filled.size} ช่อง · ไม่มีไฟล์ ${rows.length - filled.size} ช่อง (ใส่ "-")\nบันทึกที่: ${out}`);
