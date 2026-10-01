import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import { parseMonthYear, parseYouTubeRevenueRows } from "../lib/dashboard/revenueParser.ts";

const month = (v) => parseMonthYear(v)?.month ?? null;

test("Excel date cells give their own month, even a few seconds early", () => {
  // What the import received on 2026-10-01: 1 Jan 2026 00:00 arriving as 31 Dec 2025 23:59:56 (Bangkok).
  assert.equal(month(new Date(2025, 11, 31, 23, 59, 56)), "2026-01");
  assert.equal(month(new Date(2026, 8, 1)), "2026-09");
  assert.equal(parseMonthYear(new Date(2026, 0, 1)).monthLabel, "Jan 2026");
});

test("text months in English, Thai and numbers; Buddhist years converted", () => {
  assert.equal(month("Sep 2026"), "2026-09");
  assert.equal(month("September 2026"), "2026-09");
  assert.equal(month("ก.ย. 2569"), "2026-09");
  assert.equal(month("ก.ย 2569"), "2026-09");
  assert.equal(month("มี.ค. 2569"), "2026-03");
  assert.equal(month("กันยายน 2569"), "2026-09");
  assert.equal(month("2026-09"), "2026-09");
  assert.equal(month("2026/9"), "2026-09");
  assert.equal(month("2026-09-01"), "2026-09");
  assert.equal(month("09/2026"), "2026-09");
});

test("unreadable months are refused, never saved as raw text", () => {
  assert.equal(month("Wed Dec 31 2025 23:59:56 GMT+0700 (Indochina Time)"), null);
  assert.equal(month("Q3 2026"), null);
  assert.equal(month("2026-13"), null);
  assert.equal(month(""), null);
  assert.throws(
    () => parseYouTubeRevenueRows([{ Month: "Q3 2026", "Estimated revenue": "100" }]),
    /อ่านเดือนไม่ได้ 1 แถว/,
  );
});

test("an Excel sheet with date cells imports month by month", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Monthly", "Estimated revenue", "Estimated partner ad revenue"],
    [new Date(2026, 0, 1), 1000.5, 900],
    [new Date(2026, 1, 1), 1200, 1000],
    [new Date(2026, 9, 1), 0, 0], // empty template row
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Revenue");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const rows = XLSX.utils.sheet_to_json(XLSX.read(buffer, { type: "array", cellDates: true }).Sheets.Revenue, { defval: null });
  const items = parseYouTubeRevenueRows(rows);
  assert.deepEqual(items.map((x) => [x.month, x.monthLabel, x.year, x.estRevenue]), [
    ["2026-01", "Jan 2026", 2026, 1000.5],
    ["2026-02", "Feb 2026", 2026, 1200],
  ]);
});
