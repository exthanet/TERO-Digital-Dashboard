import assert from "node:assert/strict";
import test from "node:test";
import { autoGrain, grainLabel, lastWeekRatings, tvAudienceTrend } from "../lib/dashboard/tvTrend.ts";

const tv = (date, o = {}) => ({ date, platform: "TV", program: "ถกไม่เถียง", topic: "", ratingTotal: 0, gmmRating: 0, audienceTotal: 0, gmmAudience: 0, ...o });

test("longer than 31 days: month by month", () => {
  assert.equal(autoGrain("2026-09-01", "2026-09-30"), "day");
  assert.equal(autoGrain("2026-09-01", "2026-10-01"), "day");
  assert.equal(autoGrain("2026-09-01", "2026-10-02"), "month");
  assert.equal(autoGrain("2026-01-01", "2026-12-31"), "month");
  assert.equal(grainLabel("2026-09", "month"), "ก.ย. 69");
});

test("audience: a day is the total, a month the average per episode", () => {
  const rows = [tv("2026-09-01", { audienceTotal: 100, gmmAudience: 40 }), tv("2026-09-01", { audienceTotal: 300 }), tv("2026-10-05", { audienceTotal: 50, gmmAudience: 10 })];
  assert.deepEqual(tvAudienceTrend(rows, "day").map((x) => [x.date, x.ONE31, x.GMM25]), [["2026-09-01", 400, 40], ["2026-10-05", 50, 10]]);
  const m = tvAudienceTrend(rows, "month");
  assert.deepEqual(m.map((x) => [x.date, x.ONE31, x.GMM25, x.oneEpisodes, x.gmmEpisodes]), [["2026-09", 200, 40, 2, 1], ["2026-10", 50, 10, 1, 1]]);
});

test("rating of the latest 7 aired days up to the range end, per program and channel", () => {
  const rows = [tv("2026-09-23", { ratingTotal: 9 }), tv("2026-09-24", { ratingTotal: 0.4, gmmRating: 0.2 }), tv("2026-09-30", { ratingTotal: 0.2 }), tv("2026-10-01"), tv("2026-10-12", { ratingTotal: 9 })];
  // Range ends 10-11; the latest rated episode is 09-30 (10-01 has no rating yet).
  const { from, to, ratings: w } = lastWeekRatings(rows, "2026-10-11");
  assert.deepEqual([from, to], ["2026-09-24", "2026-09-30"]);
  assert.ok(Math.abs(w.get("ถกไม่เถียง|One31").rating - 0.3) < 1e-9);
  assert.equal(w.get("ถกไม่เถียง|One31").episodes, 2);
  assert.equal(w.get("ถกไม่เถียง|GMM25").rating, 0.2);
  assert.deepEqual(lastWeekRatings(rows, "2026-10-11").episodes.map((r) => r.date), ["2026-09-30", "2026-09-24"]);
  assert.equal(lastWeekRatings([], "2026-10-11").to, "");
});
