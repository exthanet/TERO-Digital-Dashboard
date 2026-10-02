import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { audienceTotals, engagementByPlatform, facebookCtr, postHour, viewsByPostHour } from "../lib/dashboard/audience.ts";

const row = (o) => normalize({ Date: "2026-09-20", Program: "ถกไม่เถียง", Topic: "c", Platform: "YouTube", Views: "1000", Likes: "10", Comments: "2", Shares: "0", ...o });

test("posting hour from Bangkok HH:MM", () => {
  assert.equal(postHour("08:05"), 8);
  assert.equal(postHour("23:59"), 23);
  assert.equal(postHour(""), null);
  assert.equal(postHour("25:00"), null);
});

test("totals: likes, comments, comments per 1K views, Facebook CTR from click data only", () => {
  const rows = [
    row({ Views: "1000", Likes: "10", Comments: "4" }),
    row({ Platform: "Facebook", Views: "2000", Likes: "20", Comments: "6", Clicks: "100", Impressions: "2000" }),
    row({ Platform: "Facebook", Views: "3000", Likes: "5", Comments: "0" }), // no click data: not in CTR
    row({ Platform: "TV", Views: "500000", Likes: "0", Comments: "0" }), // TV is left out
  ];
  const t = audienceTotals(rows);
  assert.equal(t.likes, 35);
  assert.equal(t.comments, 10);
  assert.equal(t.commentsPer1k, (10 / 6000) * 1000);
  assert.equal(t.ctr, 0.05);
  assert.equal(t.ctrPosts, 1);
  assert.equal(audienceTotals([row({})]).ctr, null);
});

test("views by posting hour: all 24 hours, per platform, median per clip, coverage", () => {
  const rows = [
    row({ Publish_Time: "08:10", Views: "100" }),
    row({ Publish_Time: "08:40", Views: "300" }),
    row({ Publish_Time: "08:50", Views: "1000", Platform: "TikTok" }),
    row({ Publish_Time: "", Views: "999" }),
  ];
  const h = viewsByPostHour(rows);
  assert.equal(h.points.length, 24);
  assert.equal(h.withTime, 3);
  assert.equal(h.total, 4);
  const eight = h.points[8];
  assert.equal(eight.hour, "08:00");
  assert.equal(eight.clips, 3);
  assert.equal(eight.medianViews, 300);
  assert.equal(eight.YouTube, 400);
  assert.equal(eight.TikTok, 1000);
  assert.equal(h.points[9].clips, 0);
});

test("per platform engagement and Facebook CTR trend", () => {
  const rows = [
    row({ Platform: "Facebook", Date: "2026-09-01", Views: "1000", Comments: "5", Clicks: "10", Impressions: "1000", Topic: "a" }),
    row({ Platform: "Facebook", Date: "2026-09-01", Views: "1000", Comments: "5", Clicks: "30", Impressions: "1000", Topic: "b" }),
    row({ Platform: "Facebook", Date: "2026-09-02", Views: "1000", Comments: "0", Clicks: "5", Impressions: "500", Topic: "c" }),
  ];
  const p = engagementByPlatform(rows);
  assert.deepEqual(p.map((x) => [x.platform, x.comments, x.commentsPer1k]), [["Facebook", 10, (10 / 3000) * 1000]]);
  const c = facebookCtr(rows, "day");
  assert.deepEqual(c.trend, [{ date: "2026-09-01", ctr: 2, clicks: 40 }, { date: "2026-09-02", ctr: 1, clicks: 5 }]);
  assert.deepEqual(c.top.map((r) => r.topic), ["b", "a", "c"]);
});
