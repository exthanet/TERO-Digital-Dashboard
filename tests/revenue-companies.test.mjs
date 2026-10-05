import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeRevenueRows, sheetRole } from "../lib/dashboard/revenueParser.ts";
import { companyMonths, revenueChecks } from "../lib/dashboard/revenueCompanies.ts";

const row = (month, est, extra = {}) => ({ Monthly: month, "EST.Revenue": est, "Estimated partner ad revenue": est, ...extra });

test("sheet names decide what each sheet holds", () => {
  assert.equal(sheetRole("Overall 2026"), "overall");
  assert.equal(sheetRole("Summary 2026 - TERO Digital"), "digital");
  assert.equal(sheetRole("Summary 2026 - TERO ENTERTAINME"), "entertainment");
  assert.equal(sheetRole("Sheet1"), null);
});

test("company months and the part of Overall neither sheet holds", () => {
  const overall = parseYouTubeRevenueRows([row("Jan 2026", 100)]);
  const digital = parseYouTubeRevenueRows([row("Jan 2026", 60)]);
  const ent = parseYouTubeRevenueRows([row("Dec 2025", 5), row("Jan 2026", 30)]);
  const m = companyMonths(overall, digital, ent);
  assert.deepEqual(
    m.map((x) => [x.month, x.overall, x.digital, x.entertainment, x.other]),
    [
      ["2025-12", null, null, 5, null],
      ["2026-01", 100, 60, 30, 10],
    ],
  );
});

test("checks: gaps, columns entered elsewhere, totals that are not the sum", () => {
  const overall = parseYouTubeRevenueRows([row("Feb 2026", 1000, { "Shopping Star Bonus": 500, "Estimated partner ad revenue": 500 })]);
  const digital = parseYouTubeRevenueRows([row("Feb 2026", 700, { "Shopping Affiliate bonus": 400, "Estimated partner ad revenue": 250 })]);
  const ent = parseYouTubeRevenueRows([row("Feb 2026", 100)]);
  const c = revenueChecks(overall, digital, ent);
  assert.deepEqual(c.gaps, [{ month: "2026-02", overall: 1000, companies: 800, gap: 200 }]);
  assert.deepEqual(c.columns.map((x) => [x.label, x.overall, x.companies]), [["Shopping Affiliate bonus", 0, 400]]);
  // Digital: 700 vs 250 + 400 = 650.
  assert.deepEqual(c.totals.map((t) => [t.sheet, t.diff]), [["TERO Digital", 50]]);
});

test("rates: matched to the month whose EST.Revenue the row repeats; THB = USD × rate, months without a rate left out", async () => {
  const { ratesFromGrid } = await import("../lib/dashboard/revenueParser.ts");
  const { inCurrency } = await import("../lib/dashboard/revenueCompanies.ts");
  const months = parseYouTubeRevenueRows([row("Sep 2025", 1200.498), row("Oct 2025", 2300.004), row("Nov 2025", 3400)]);
  const grid = [
    ["Monthly", "EST.Revenue"],
    [null, null],
    ["Tero Ent", "Diff Tero Ent", "Ads revenue", "WT", "Rate", "THB"],
    [1200.5, 100, 1000, 20, 33.5, 32830],
    [2300, 200, 2000, 40, 34, 66640],
    [1234.56, 0, 0, 0, 33, 0],
  ];
  const { rates, unmatched } = ratesFromGrid(grid, months);
  assert.deepEqual(rates, { "2025-09": 33.5, "2025-10": 34 });
  assert.equal(unmatched, 1);
  const thb = inCurrency(months, "THB", rates);
  assert.deepEqual(thb.items.map((m) => m.month), ["2025-09", "2025-10"]);
  assert.ok(Math.abs(thb.items[0].estRevenue - 1200.498 * 33.5) < 1e-6);
  assert.ok(Math.abs(thb.items[0].partnerAdRevenue - 1200.498 * 33.5) < 1e-6);
  assert.deepEqual(thb.missing, ["Nov 2025"]);
  assert.equal(inCurrency(months, "USD", rates).items, months);
});
