import assert from "node:assert/strict";
import test from "node:test";
import { autoGrain, grainLabel, tvAudienceTrend, tvEpisodes } from "../lib/dashboard/tvTrend.ts";

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

test("episodes: TV rows only, newest first", () => {
  const rows = [tv("2026-09-24"), tv("2026-09-30", { program: "B" }), tv("2026-09-30", { program: "A" }), { ...tv("2026-10-01"), platform: "YouTube" }];
  assert.deepEqual(tvEpisodes(rows).map((r) => r.date + r.program), ["2026-09-30A", "2026-09-30B", "2026-09-24ถกไม่เถียง"]);
});
