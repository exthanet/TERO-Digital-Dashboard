import assert from "node:assert/strict";
import test from "node:test";
import { kindOf, monthTotals, readAffiliateSheets, topProducts } from "../lib/dashboard/affiliateSheets.ts";

const period = {
  "Table data": [
    { Date: "Total", "Earned revenue (THB)": 300, Orders: 30, "Total sales (THB)": 10000 },
    { Date: "2026-09", "Earned revenue (THB)": 200, Orders: 20, "Total sales (THB)": 6000 },
    { Date: "2026-08", "Earned revenue (THB)": 100, Orders: 10, "Total sales (THB)": 4000 },
  ],
  Totals: [{ Date: "2026-08", "Earned revenue (THB)": 100 }],
};
const product = {
  "Table data": [
    { Product: "Total", "Product title": null, "Estimated revenue (THB)": 90, "Total sales (THB)": 3000, Orders: 12 },
    { Product: "p1", "Product title": "iPhone 17", "Estimated revenue (THB)": 50, "Total sales (THB)": 2500, Orders: 2 },
    { Product: "p2", "Product title": "ครีมทามือ", "Estimated revenue (THB)": 40, "Total sales (THB)": 500, Orders: 10 },
    { Product: "Showing top 500 results", "Product title": null, "Estimated revenue (THB)": null, "Total sales (THB)": null, Orders: null },
  ],
  "Chart data": [{ Date: "2026-09-01", Product: "p1", "Product title": "iPhone 17", "Estimated revenue (THB)": 5 }],
  Totals: [
    { Date: "2026-09-02", "Estimated revenue (THB)": 7 },
    { Date: "2026-08-31", "Estimated revenue (THB)": 3 },
  ],
};
const content = {
  "Table data": [
    { Content: "Total", "Video title": null, "Estimated revenue (THB)": 1, "Earned revenue (THB)": 1, "Total commission (THB)": 2, "Removed commission (THB)": -1 },
    { Content: "abc", "Video title": "ถกไม่เถียง EP1", "Video publish time": "2026-09-01", Duration: 600, "Estimated revenue (THB)": 1, "Earned revenue (THB)": 1, "Total commission (THB)": 2, "Removed commission (THB)": -1 },
  ],
  Totals: [{ Date: "2026-08-31", "Estimated revenue (THB)": 3 }],
};

test("each export is told apart by its headers, in any order; summary rows are left out", () => {
  assert.equal(kindOf(period), "period");
  assert.equal(kindOf(product), "product");
  assert.equal(kindOf(content), "content");
  const d = readAffiliateSheets([product, content, period]);
  assert.deepEqual(d.monthly.map((m) => m.month), ["2026-08", "2026-09"]);
  assert.deepEqual(d.products.map((p) => p.productId), ["p1", "p2"]);
  assert.equal(d.contents.length, 1);
  assert.equal(d.contents[0].removedCommission, -1);
  assert.deepEqual(d.daily, [
    { date: "2026-08-31", revenue: 3 },
    { date: "2026-09-02", revenue: 7 },
  ]);
  assert.deepEqual(d.productRange, { from: "2026-08-31", to: "2026-09-02" });
});

test("top products by orders, commission and sales; month totals and rate", () => {
  const d = readAffiliateSheets([period, product]);
  assert.equal(topProducts(d.products, "orders")[0].productId, "p2");
  assert.equal(topProducts(d.products, "commission")[0].productId, "p1");
  assert.equal(topProducts(d.products, "totalSales")[0].productId, "p1");
  const all = monthTotals(d.monthly, []);
  assert.equal(all.earnedRevenue, 300);
  assert.equal(all.rate, 0.03);
  const sep = monthTotals(d.monthly, ["2026-09"]);
  assert.equal(sep.orders, 20);
  assert.equal(sep.perOrder, 10);
});

test("an export of one whole calendar month is that month's; picked months add up their exports", async () => {
  const { monthOfRange, listsFor } = await import("../lib/dashboard/affiliateSheets.ts");
  assert.equal(monthOfRange({ from: "2026-09-01", to: "2026-09-30" }), "2026-09");
  assert.equal(monthOfRange({ from: "2026-10-01", to: "2026-10-14" }), "2026-10"); // the running month so far
  assert.equal(monthOfRange({ from: "2026-09-05", to: "2026-09-30" }), "");
  assert.equal(monthOfRange({ from: "2026-01-01", to: "2026-10-14" }), "");
  const month = (m, last, rows) => ({
    "Table data": rows,
    Totals: [{ Date: `${m}-01`, "Estimated revenue (THB)": 1 }, { Date: `${m}-${last}`, "Estimated revenue (THB)": 1 }],
  });
  const p = (id, c, o) => ({ Product: id, "Product title": id, "Estimated revenue (THB)": c, "Total sales (THB)": c * 10, Orders: o });
  const d = readAffiliateSheets([product, month("2026-08", "31", [p("p1", 5, 1), p("p3", 9, 9)]), month("2026-09", "30", [p("p1", 7, 2)])]);
  assert.deepEqual(Object.keys(d.productsByMonth).sort(), ["2026-08", "2026-09"]);
  assert.deepEqual(d.products.map((x) => x.productId), ["p1", "p2"]); // the long export stays as it is
  const sep = listsFor(d, ["2026-09"]);
  assert.deepEqual(sep.productMonths, ["2026-09"]);
  assert.deepEqual(sep.products.map((x) => [x.productId, x.commission]), [["p1", 7]]);
  const both = listsFor(d, ["2026-08", "2026-09"]);
  assert.deepEqual(both.products.map((x) => [x.productId, x.commission, x.orders]), [["p1", 12, 3], ["p3", 9, 9]]);
  const withMissing = listsFor(d, ["2026-07", "2026-09"]);
  assert.deepEqual(withMissing.productMonths, []);
  assert.deepEqual(withMissing.missing, ["2026-07"]);
  assert.deepEqual(listsFor(d, []).productMonths, []); // all: the long export
});

test("stored as one document per month and put back the same; the diff says what is new or changed", async () => {
  const { splitForStore, joinFromStore, diffAffiliate } = await import("../lib/dashboard/affiliateSheets.ts");
  const month = (m, last, rows) => ({ "Table data": rows, Totals: [{ Date: `${m}-01`, "Estimated revenue (THB)": 1 }, { Date: `${m}-${last}`, "Estimated revenue (THB)": 1 }] });
  const p = (id, c) => ({ Product: id, "Product title": id, "Estimated revenue (THB)": c, "Total sales (THB)": 1, Orders: 1 });
  const d = readAffiliateSheets([period, product, month("2026-09", "30", [p("a", 1)])]);
  const { main, months } = splitForStore(d);
  assert.deepEqual(main.months, ["2026-09"]);
  assert.equal("productsByMonth" in main, false);
  const back = joinFromStore(JSON.parse(JSON.stringify(main)), JSON.parse(JSON.stringify(months)));
  assert.deepEqual(back.productsByMonth, d.productsByMonth);
  assert.equal(diffAffiliate(back, d).any, false);
  const later = readAffiliateSheets([period, product, month("2026-09", "30", [p("a", 2)]), month("2026-10", "31", [p("b", 1)])]);
  const diff = diffAffiliate(back, later);
  assert.deepEqual(diff.added, ["2026-10"]);
  assert.deepEqual(diff.changed, ["2026-09"]);
  assert.equal(diff.longChanged, false);
  assert.deepEqual(diffAffiliate(null, d).added, ["2026-08", "2026-09"]);
});

test("merge keeps the months the links no longer carry; one month can be taken out", async () => {
  const { mergeAffiliate, withoutMonth, diffAffiliate } = await import("../lib/dashboard/affiliateSheets.ts");
  const month = (m, last, rows) => ({ "Table data": rows, Totals: [{ Date: `${m}-01`, "Estimated revenue (THB)": 1 }, { Date: `${m}-${last}`, "Estimated revenue (THB)": 1 }] });
  const p = (id, c) => ({ Product: id, "Product title": id, "Estimated revenue (THB)": c, "Total sales (THB)": 1, Orders: 1 });
  const stored = readAffiliateSheets([period, product, month("2026-09", "30", [p("a", 1)])]);
  // Next time only the October link is left.
  const draft = readAffiliateSheets([month("2026-10", "31", [p("b", 2)])]);
  const merged = mergeAffiliate(stored, draft);
  assert.deepEqual(Object.keys(merged.productsByMonth).sort(), ["2026-09", "2026-10"]);
  assert.deepEqual(merged.monthly.map((m) => m.month), ["2026-08", "2026-09"]); // revenue by period kept
  assert.deepEqual(merged.products.map((x) => x.productId), ["p1", "p2"]); // the long export kept
  const diff = diffAffiliate(stored, merged);
  assert.deepEqual(diff.added, ["2026-10"]);
  assert.deepEqual(diff.changed, []);
  assert.equal(diff.longChanged, false);
  const out = withoutMonth(merged, "2026-09");
  assert.deepEqual(Object.keys(out.productsByMonth), ["2026-10"]);
  assert.deepEqual(out.monthly.map((m) => m.month), ["2026-08", "2026-09"]);
  assert.equal(mergeAffiliate(null, draft), draft);
});

test("a clicks report of products adds clicks and never zeroes the revenue or the daily totals", async () => {
  const { mergeAffiliate } = await import("../lib/dashboard/affiliateSheets.ts");
  const days = (m, last, name, v) => [{ Date: `${m}-01`, [name]: v }, { Date: `${m}-${last}`, [name]: v }];
  const revenue = { "Table data": [{ Product: "a", "Product title": "A", "Estimated revenue (THB)": 10, "Total sales (THB)": 100, Orders: 2 }], Totals: days("2026-09", "30", "Estimated revenue (THB)", 5) };
  const clicks = { "Table data": [{ Product: "a", "Product title": "A", "Product clicks": 40, "Product impressions": 900 }], Totals: days("2026-09", "30", "Product clicks", 999) };
  const both = readAffiliateSheets([revenue, clicks]);
  assert.deepEqual(both.productsByMonth["2026-09"].map((p) => [p.commission, p.orders, p.clicks, p.impressions]), [[10, 2, 40, 900]]);
  assert.deepEqual(both.daily.map((d) => d.revenue), [5, 5]);
  assert.deepEqual(both.sources.map((s) => s.metrics), ["revenue", "clicks"]);
  // Clicks first, revenue later in another import: one row with both.
  const later = mergeAffiliate(readAffiliateSheets([clicks]), readAffiliateSheets([revenue]));
  assert.deepEqual(later.productsByMonth["2026-09"].map((p) => [p.commission, p.clicks]), [[10, 40]]);
  // Revenue stored, then only the clicks report: revenue stays.
  const kept = mergeAffiliate(readAffiliateSheets([revenue]), readAffiliateSheets([clicks]));
  assert.deepEqual(kept.productsByMonth["2026-09"].map((p) => [p.commission, p.clicks]), [[10, 40]]);
  assert.deepEqual(kept.daily.map((d) => d.revenue), [5, 5]);
});
