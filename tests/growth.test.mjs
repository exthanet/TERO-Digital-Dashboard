import assert from "node:assert/strict";
import test from "node:test";
import { daysBetween, mergeGrowth, recordKey, summarizeGrowth } from "../lib/dashboard/growth.ts";
import { buildGrowth, growthDayFor } from "../lib/integrations/growthWriter.ts";
import { rowKey } from "../lib/integrations/metricoolSync.ts";
import { normalize } from "../lib/dashboard/normalize.ts";

const yt = (id, extra = {}) => ({ Platform: "YouTube", URL: `https://www.youtube.com/watch?v=${id}`, Content_ID: id, ...extra });

test("gains are filed under the day before the sync", () => {
  assert.equal(growthDayFor("2026-10-02"), "2026-10-01");
  assert.equal(growthDayFor("2026-03-01"), "2026-02-28");
});

test("updated posts give new − old; fresh posts count from 0; late posts are left out", () => {
  const result = {
    updated: [
      { key: "YouTube|aaaaaaaaaaa", before: { Views: "1,000", Likes: "10", Comments: "2", Shares: "1" }, after: { Views: "1,500", Likes: "12" } },
      { key: "YouTube|bbbbbbbbbbb", before: { Views: "900", Likes: "5", Comments: "0", Shares: "0" }, after: { Views: "880" } },
      { key: "YouTube|ccccccccccc", before: { Views: "50" }, after: { Engagement_Rate: "2%" } }, // no count changed
    ],
    inserted: [
      yt("ddddddddddd", { Date: "2026-10-01", Views: "300", Likes: "3", Comments: "1", Shares: "0" }),
      yt("eeeeeeeeeee", { Date: "2026-09-30", Views: "700", Likes: "7", Comments: "0", Shares: "1" }),
      yt("fffffffffff", { Date: "2026-09-20", Views: "99999", Likes: "1", Comments: "0", Shares: "0" }),
    ],
  };
  const { entries, late } = buildGrowth(result, "2026-10-01");
  assert.deepEqual(entries, [
    ["YouTube|aaaaaaaaaaa", 500, 2, 0, 0, 0],
    ["YouTube|bbbbbbbbbbb", -20, 0, 0, 0, 0], // a drop is kept as it is
    ["YouTube|ddddddddddd", 300, 3, 1, 0, 1],
    ["YouTube|eeeeeeeeeee", 700, 7, 0, 1, 1],
  ]);
  assert.equal(late, 1);
});

test("a second run on the same day adds to the first", () => {
  const merged = mergeGrowth([["k1", 10, 1, 0, 0, 1], ["k2", 5, 0, 0, 0, 0]], [["k1", 4, 0, 1, 0, 0], ["k3", 2, 0, 0, 0, 0]]);
  assert.deepEqual(merged, [["k1", 14, 1, 1, 0, 1], ["k2", 5, 0, 0, 0, 0], ["k3", 2, 0, 0, 0, 0]]);
});

test("the dashboard and the sync build the same post key", () => {
  const raw = yt("aaaaaaaaaaa", { Date: "2026-09-01", Program: "ถกไม่เถียง", Views: "1" });
  assert.equal(rowKey(raw), "YouTube|aaaaaaaaaaa");
  assert.equal(recordKey(normalize(raw)), rowKey(raw));
  const fb = { Platform: "Facebook", URL: "https://www.facebook.com/tero/videos/1234567890123/", Date: "2026-09-01", Views: "1" };
  assert.equal(recordKey(normalize(fb)), rowKey(fb));
});

test("summary follows the filtered rows and splits old and new clips", async () => {
  const rows = [
    normalize(yt("aaaaaaaaaaa", { Date: "2026-08-01", Program: "ถกไม่เถียง", Views: "5000", Topic: "old clip" })),
    normalize(yt("bbbbbbbbbbb", { Date: "2026-09-29", Program: "ถกไม่เถียง", Views: "800", Topic: "new clip" })),
  ];
  assert.equal(recordKey(rows[0]), "YouTube|aaaaaaaaaaa");
  const days = new Map([
    ["2026-09-29", [["YouTube|aaaaaaaaaaa", 100, 5, 0, 0, 0], ["YouTube|bbbbbbbbbbb", 300, 10, 2, 1, 1], ["YouTube|zzzzzzzzzzz", 999, 0, 0, 0, 0]]],
    ["2026-09-30", [["YouTube|aaaaaaaaaaa", -10, 0, 0, 0, 0], ["YouTube|bbbbbbbbbbb", 200, 0, 0, 0, 0]]],
    ["2026-10-01", null],
  ]);
  const s = summarizeGrowth(daysBetween("2026-09-29", "2026-10-01"), days, rows, "2026-09-29");
  assert.equal(s.daysWithData, 2);
  assert.equal(s.views, 590); // the post outside the filters (zzz…) is not counted
  assert.equal(s.unmatched, 1);
  assert.equal(s.viewsFromOlder, 90);
  assert.equal(s.engagement, 18);
  assert.equal(s.clipsGaining, 2);
  assert.equal(s.drops, 1);
  assert.deepEqual(s.clips.map((c) => [c.key, c.views, c.dropped]), [
    ["YouTube|bbbbbbbbbbb", 500, false],
    ["YouTube|aaaaaaaaaaa", 90, true],
  ]);
  assert.deepEqual(s.daily.map((d) => [d.date, d.hasData, d.YouTube ?? 0]), [
    ["2026-09-29", true, 400],
    ["2026-09-30", true, 190],
    ["2026-10-01", false, 0],
  ]);
});
