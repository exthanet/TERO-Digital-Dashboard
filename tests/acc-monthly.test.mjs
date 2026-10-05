import assert from "node:assert/strict";
import test from "node:test";
import { ACC_CHANNELS, TERO_DIGITAL, accSheetRows, accTotals, monthEnd, monthsBetween, programVideoIds } from "../lib/dashboard/accMonthly.ts";
import { collectAccMonth } from "../lib/integrations/accMonthlyCollect.ts";

test("month helpers", () => {
  assert.equal(monthEnd("2026-02"), "2026-02-28");
  assert.equal(monthEnd("2026-09"), "2026-09-30");
  assert.deepEqual(monthsBetween("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("collector: one month per channel, capped at today; playback places and live split", async () => {
  const seen = [];
  const reply = (cols, rows) => ({ ok: true, status: 200, json: async () => ({ columnHeaders: cols.map((name) => ({ name })), rows }) });
  const fake = async (url) => {
    const p = new URL(url).searchParams;
    seen.push([p.get("startDate"), p.get("endDate")]);
    const m = p.get("metrics"), d = p.get("dimensions");
    // A show's clips: a tenth of the channel per clip id in the filter.
    const k = p.get("filters").startsWith("video==") ? p.get("filters").slice(7).split(",").length / 10 : 1;
    if (m === "views,redViews") return reply(["views", "redViews"], [[1000 * k, 40 * k]]);
    if (m.startsWith("estimatedAdRevenue")) return reply(["estimatedAdRevenue", "estimatedRedPartnerRevenue"], [[2.5 * k, 0.5 * k]]);
    if (d === "insightPlaybackLocationType") return reply([d, "views"], [["WATCH", 600 * k], ["SHORTS_FEED", 300 * k], ["EMBEDDED", 60 * k], ["CHANNEL", 40 * k]]);
    if (d === "liveOrOnDemand") return reply([d, "views"], [["ON_DEMAND", 900 * k], ["LIVE", 100 * k]]);
    throw new Error("unexpected " + url);
  };
  const m = await collectAccMonth("t", "owner", "2026-10", "2026-10-05", { "ถกไม่เถียง": ["a", "b", "c"], "เงินทองของจริง": ["d"] }, async () => {}, fake);
  assert.equal(m.through, "2026-10-05");
  assert.deepEqual(seen[0], ["2026-10-01", "2026-10-05"]);
  assert.equal(m.rows.length, ACC_CHANNELS.length);
  const { name, channelId, ...nums } = m.rows[0];
  assert.equal(name, ACC_CHANNELS[0].name);
  assert.deepEqual(nums, { views: 1000, premiumViews: 40, watchPage: 600, embedded: 60, channelPage: 40, live: 100, onDemand: 900, adRevenue: 2.5, premiumRevenue: 0.5 });
  const row = (n) => m.rows.find((r) => r.name === n);
  // Shows from their clips; the channel line keeps the rest, and the three add up to the channel.
  assert.equal(row("ถกไม่เถียง").views, 300);
  assert.equal(row("เงินทองของจริง").adRevenue, 0.25);
  assert.equal(row("TERO Digital").views, 600);
  assert.equal(row("TERO Digital").adRevenue, 1.5);
  assert.equal(row("TERO Digital").channelId, TERO_DIGITAL);
  assert.equal(row("brainchild tv3").missing, true);
  assert.equal(row("brainchild tv3").views, 0);
  const full = await collectAccMonth("t", "owner", "2026-09", "2026-10-05", {}, async () => {}, fake);
  assert.equal(full.through, "2026-09-30");
});

test("show clips: masterData Program first, then the title", () => {
  const uploads = [{ id: "a", title: "ถกไม่เถียง EP1" }, { id: "b", title: "ถก ไม่เถียง สัมภาษณ์" }, { id: "c", title: "เงินทองของจริง | หุ้น" }, { id: "d", title: "ถกไม่เถียง แต่ masterData บอกว่า PROMO" }, { id: "e", title: "อื่นๆ" }];
  const programOf = new Map([["d", "PROMO"], ["e", "เงินทองของจริง"]]);
  assert.deepEqual(programVideoIds(uploads, programOf, ["ถกไม่เถียง", "เงินทองของจริง"]), { "ถกไม่เถียง": ["a", "b"], "เงินทองของจริง": ["c", "e"] });
});

test("totals and export rows: CMS column names, total line, THB by rate", () => {
  const r = (name, views, adRevenue) => ({ name, channelId: "UC" + name, premiumViews: 1, views, watchPage: 1, embedded: 0, channelPage: 0, live: 0, onDemand: views, adRevenue, premiumRevenue: 0.1 });
  const month = { month: "2026-09", through: "2026-09-30", updatedAt: "", rows: [r("A", 100, 1.25), r("B", 50, 0.75)] };
  assert.equal(accTotals(month.rows).views, 150);
  const rows = accSheetRows(month, 30, "THB");
  assert.equal(rows.length, 3);
  assert.equal(rows[2]["Channel Display Name"], "รวม");
  assert.equal(rows[2]["Ads Partner Revenue (THB)"], 60);
  assert.equal(rows[0]["Owned Views : Ad-Enabled"], "");
  assert.equal(rows[1]["YouTube Premium partner revenue (THB)"], 3);
  const gap = accSheetRows({ ...month, rows: [{ ...r("X", 0, 0), channelId: "", missing: true }] });
  assert.equal(gap[0]["Owned Views"], "");
  assert.equal(gap[0]["หมายเหตุ"], "ไม่พบช่องนี้ใน CMS ที่เชื่อมต่อ");
});
