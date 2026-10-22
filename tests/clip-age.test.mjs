import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { rankContentsAtAge, viewsAtAge } from "../lib/dashboard/clipAge.ts";
import { recordKey } from "../lib/dashboard/growth.ts";

const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tk = (n, date, views) => normalize({ Date: date, Program: "ถกไม่เถียง", Topic: `clip ${n}`, Platform: "TikTok", VDO_Type: "TikTok", URL: `https://www.tiktok.com/@a/video/9${String(n).padStart(18, "0")}`, Views: String(views) });

test("views at the same age: an old clip's later views do not count; a clip without a full window is left out", () => {
  const early = tk(1, "2026-10-01", 900000); // lifetime views are big, but only its first 7 days count
  const late = tk(2, "2026-10-05", 1000);
  const young = tk(3, "2026-10-12", 50);
  const days = new Map();
  for (let i = 0; i < 14; i++) days.set(add("2026-10-01", i), []);
  const put = (r, d, v) => days.get(d).push([recordKey(r), v, 0, 0, 0, 0]);
  for (let i = 0; i < 14; i++) put(early, add("2026-10-01", i), i < 7 ? 100 : 100000);
  for (let i = 0; i < 9; i++) put(late, add("2026-10-05", i), 200);
  put(young, "2026-10-12", 50);
  assert.equal(viewsAtAge(early, days), 700);
  assert.equal(viewsAtAge(late, days), 1400);
  assert.equal(viewsAtAge(young, days), null); // its window runs past the data
  const others = Array.from({ length: 3 }, (_, i) => tk(10 + i, "2026-10-02", 1));
  for (const r of others) for (let i = 0; i < 7; i++) put(r, add("2026-10-02", i), 10);
  const r = rankContentsAtAge([early, late, young, ...others], { start: "2026-10-01", end: "2026-10-31" }, days, 2);
  assert.equal(r.young, 1);
  assert.equal(r.ranked, 5);
  assert.deepEqual(r.best.map((x) => x.group.lead.topic), ["clip 2", "clip 1"]); // 1,400 beats 700 at the same age
  assert.equal(r.best[0].ageViews, 1400);
  assert.ok(r.best[0].index > 1);
  assert.deepEqual(r.worst.map((x) => x.ageViews), [70, 70]);
});

test("posted before the daily data began: no data, not ranked", () => {
  const old = tk(5, "2026-09-28", 5000);
  const days = new Map([["2026-10-01", []], ["2026-10-02", []]]);
  const r = rankContentsAtAge([old], { start: "2026-09-01", end: "2026-09-30" }, days);
  assert.equal(r.ranked, 0);
  assert.equal(r.young + r.noData, 1);
});
