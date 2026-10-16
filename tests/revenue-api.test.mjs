import assert from "node:assert/strict";
import test from "node:test";
import { forecastBase, pendingNote, thDay, withApiMonths } from "../lib/dashboard/revenueApi.ts";

const fileMonth = (month, est) => ({ month, monthLabel: month, year: 2026, estRevenue: est, partnerAdRevenue: est * 0.7, youtubePremiumRevenue: est * 0.2, affiliateProgramRevenue: 1, shortsFeedAdsRevenue: 1 });
const api = (month, complete, est = 100) => ({ month, endDate: complete ? `${month}-30` : `${month}-16`, complete, estRevenue: est, partnerAdRevenue: 70, youtubePremiumRevenue: 20, updatedAt: "" });

test("the API fills only months the file has not got; the file always wins", () => {
  const out = withApiMonths([fileMonth("2026-08", 500), fileMonth("2026-09", 600)], [api("2026-09", true, 999), api("2026-10", false)]);
  assert.deepEqual(out.map((m) => m.month), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(out[1].estRevenue, 600);
  assert.equal(out[1].api, undefined);
  const oct = out[2];
  assert.equal(oct.monthLabel, "Oct 2026");
  assert.deepEqual(oct.api, { endDate: "2026-10-16", complete: false });
  assert.equal(oct.estRevenue, 100);
  assert.equal(oct.affiliateProgramRevenue, 0);
  assert.equal(pendingNote(out), "รอสรุปผล ต.ค.");
  assert.equal(pendingNote(out.slice(0, 2)), "");
  assert.equal(thDay("2026-10-16"), "16 ต.ค.");
});

test("a running month is never the base of a forecast; a finished API month is", () => {
  const out = withApiMonths([fileMonth("2026-08", 500)], [api("2026-09", true), api("2026-10", false)]);
  assert.deepEqual(forecastBase(out).map((m) => m.month), ["2026-08", "2026-09"]);
  assert.equal(pendingNote(out), "รอสรุปผล ก.ย., ต.ค.");
});

test("an empty API month is left out", () => {
  assert.equal(withApiMonths([], [api("2026-11", false, 0)]).length, 0);
});
