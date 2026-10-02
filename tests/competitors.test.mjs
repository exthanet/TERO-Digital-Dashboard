import assert from "node:assert/strict";
import test from "node:test";
import { OWN_KEY, competitorRanking, competitorTrend, outOfRange, seriesOf } from "../lib/dashboard/competitors.ts";

const rows = [
  { date: "2026-09-01", competitorChannel: "ช่อง 3", program: "ละคร A", slot: "", rating: 1.0 },
  { date: "2026-09-02", competitorChannel: "ช่อง 3", program: "ละคร B", slot: "", rating: 0.2 },
  { date: "2026-09-01", competitorChannel: "ช่อง 7", program: "ข่าว", slot: "", rating: 0.1 },
  { date: "2026-09-02", competitorChannel: "ช่อง 7", program: "ข่าว", slot: "", rating: 1351 }, // typo in the workbook
  { date: "2026-09-01", competitorChannel: "", program: "โหนกระแส", slot: "12.35 - 13.30 น.", rating: 1.5 },
];
const own = new Map([["2026-09-01", 0.5], ["2026-09-02", 0.3]]);

test("series by channel or by fixed show", () => {
  assert.deepEqual(seriesOf(rows, "channel").map((s) => s.key), ["ช่อง 3", "ช่อง 7"]);
  assert.deepEqual(seriesOf(rows, "slot"), [{ key: "โหนกระแส", slot: "12.35 - 13.30 น." }]);
});

test("ratings outside 0–30 are left out and listed for fixing", () => {
  assert.deepEqual(outOfRange(rows, "2026-09-01", "2026-09-30").map((r) => r.rating), [1351]);
  const r = competitorRanking(rows, own, "channel", "2026-09-01", "2026-09-30");
  const ch7 = r.find((x) => x.key === "ช่อง 7");
  assert.equal(ch7.avg, 0.1);
  assert.equal(ch7.days, 1);
});

test("ranking: averages best first, ถกไม่เถียง's win share per competitor", () => {
  const r = competitorRanking(rows, own, "channel", "2026-09-01", "2026-09-30");
  assert.deepEqual(r.map((x) => [x.key, Math.round(x.avg * 1000) / 1000]), [["ช่อง 3", 0.6], [OWN_KEY, 0.4], ["ช่อง 7", 0.1]]);
  assert.equal(r.find((x) => x.key === "ช่อง 3").winShare, 0.5); // 09-01 lost (0.5 < 1.0), 09-02 won (0.3 > 0.2)
  assert.equal(r.find((x) => x.key === OWN_KEY).winShare, null);
});

test("trend per day with the programmes aired, or per month", () => {
  const d = competitorTrend(rows, own, "channel", "2026-09-01", "2026-09-30", "day");
  assert.deepEqual(d.points[0], { date: "2026-09-01", [OWN_KEY]: 0.5, "ช่อง 3": 1, "ช่อง 7": 0.1, "program:ช่อง 3": "ละคร A", "program:ช่อง 7": "ข่าว" });
  assert.equal(d.points[1]["ช่อง 7"], undefined); // the typo day has no value
  const m = competitorTrend(rows, own, "channel", "2026-09-01", "2026-09-30", "month");
  assert.equal(m.points.length, 1);
  assert.equal(m.points[0][OWN_KEY], 0.4);
  assert.equal(m.points[0]["ช่อง 3"], 0.6);
});
