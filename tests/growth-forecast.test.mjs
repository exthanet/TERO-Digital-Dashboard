import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { caseStudy, forecastClip } from "../lib/dashboard/growthForecast.ts";

const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tk = (n) => normalize({ Date: "2026-10-02", Program: "ถกไม่เถียง", Topic: `c${n}`, Platform: "TikTok", VDO_Type: "TikTok", URL: `https://www.tiktok.com/@a/video/9${String(n).padStart(18, "0")}`, Views: "1" });
const key = (n) => `TikTok|9${String(n).padStart(18, "0")}`;

/** 40 TikTok clips posted on 10-02 to 10-05; each gets day 1 = 1000·k, then 50%, 20%, 10%, 2%, 1%, 0… of day 1. */
function fixture({ shortDay = "" } = {}) {
  const days = new Map();
  const start = "2026-10-01";
  for (let i = 0; i < 15; i++) days.set(add(start, i), []);
  // The first day: every clip seen is "new" there; it must not count.
  days.get(start).push([key(999), 5, 0, 0, 0, 1]);
  const rows = [tk(999)];
  const shape = [1, 0.5, 0.2, 0.1, 0.02, 0.01, 0, 0, 0, 0, 0, 0, 0];
  for (let n = 0; n < 40; n++) {
    rows.push(tk(n));
    const d0 = add("2026-10-02", n % 4);
    const day1 = 1000 * (1 + (n % 5));
    shape.forEach((s, i) => {
      const d = add(d0, i);
      if (days.has(d) && s > 0) days.get(d).push([key(n), day1 * s, 0, 0, 0, i === 0 ? 1 : 0]);
    });
  }
  // Fill every day with other clips so a usual day is long and the short day stands out.
  for (const [d, list] of days) for (let j = 0; j < (d === shortDay ? 1 : 120); j++) list.push([`YouTube|x${d}${j}`, 1, 0, 0, 0, 0]);
  return { days, rows };
}

test("multiplier, accuracy and fade day of a group, learnt from its clips", () => {
  const { days, rows } = fixture();
  const s = caseStudy(days, rows);
  assert.equal(s.groups.length, 1);
  const g = s.groups[0];
  assert.equal(g.key, "TikTok|TikTok");
  assert.equal(g.clips, 40);
  // day 7 total = 1 + .5 + .2 + .1 + .02 + .01 = 1.83 × day 1 for every clip
  assert.ok(Math.abs(g.multiplier - 1.83) < 1e-9);
  assert.equal(g.hitRate, 1);
  // gains: day 5 = 2% of day 1, under 5% → fades on day 5
  assert.equal(g.fadeDay, 5);
  assert.ok(Math.abs(g.curve[0] - 1 / 1.83) < 1e-9 && g.curve[9] === 1);
  assert.equal(s.firstPosted, "2026-10-02");
  const f = forecastClip(s, { platform: "TikTok", vdoType: "TikTok" }, 2000, 1);
  assert.ok(Math.abs(f.expected - 3660) < 1e-6);
  assert.equal(f.daysLeft, 3);
  assert.equal(forecastClip(s, { platform: "YouTube", vdoType: "Shorts" }, 2000, 1), null);
});

test("a short day: clips starting on it or the day before are left out; later its gain is spread", () => {
  const { days, rows } = fixture({ shortDay: "2026-10-04" });
  const s = caseStudy(days, rows);
  assert.deepEqual(s.shortDays, ["2026-10-04"]);
  // clips first seen 10-03 (day 2 short) and 10-04 (day 1 short) are out: 20 of 40 remain, under 30 → no group
  assert.equal(s.groups.length, 0);
});
