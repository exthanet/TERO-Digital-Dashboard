import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { lengthVsWatched, platformQuality, rankQuality, watchShare } from "../lib/dashboard/quality.ts";

const row = (o) =>
  normalize({ Date: "2026-09-20", Program: "ถกไม่เถียง", Topic: o.Topic || "clip", Platform: "YouTube", VDO_Type: "Shorts", Likes: "0", Comments: "0", Shares: "0", ...o });

test("share watched = average watch ÷ length; blank when the API gave none", () => {
  assert.equal(watchShare(row({ Views: "100", Avg_Watch_Sec: "30", Video_Length_Sec: "60" })), 0.5);
  assert.equal(watchShare(row({ Views: "100", Avg_Watch_Sec: "", Video_Length_Sec: "60" })), null);
  assert.equal(watchShare(row({ Views: "100" })), null);
  assert.equal(row({ Skip_Rate: "" }).skipRate, null);
  assert.equal(row({ Skip_Rate: "65.2" }).skipRate, 65.2);
});

test("platform cards weight by views and keep platforms apart", () => {
  const rows = [
    row({ Views: "300", Avg_Watch_Sec: "30", Video_Length_Sec: "60", Likes: "30" }), // 50%
    row({ Views: "100", Avg_Watch_Sec: "10", Video_Length_Sec: "100", VDO_Type: "Video Episode", Likes: "2" }), // 10%
    row({ Views: "50", Platform: "TikTok", VDO_Type: "TikTok", Likes: "5" }),
    row({ Views: "0", Platform: "TikTok", VDO_Type: "TikTok", Likes: "7" }), // photo-like: engagement, no views
    row({ Views: "200", Platform: "Instagram", VDO_Type: "Instagram Reels", Avg_Watch_Sec: "9", Video_Length_Sec: "60", Skip_Rate: "60" }),
    row({ Views: "200", Platform: "Instagram", VDO_Type: "Instagram Reels", Avg_Watch_Sec: "15", Video_Length_Sec: "60", Skip_Rate: "40" }),
  ];
  const cards = Object.fromEntries(platformQuality(rows).map((c) => [c.platform, c]));
  assert.equal(cards.YouTube.watched, (0.5 * 300 + 0.1 * 100) / 400);
  assert.equal(cards.YouTube.er, 32 / 400);
  assert.equal(cards.YouTube.formats.length, 2);
  assert.equal(cards.TikTok.watched, null);
  assert.equal(cards.TikTok.er, 5 / 50); // the KPI card's rule: engagement of viewed content only
  assert.equal(cards.Instagram.kept, 0.5);
  assert.equal(cards.Instagram.avgWatchSec, 12);
});

test("best and worst need 50+ views and compare with the same format's median", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    row({ Topic: `c${i}`, Views: String(100 + i), Avg_Watch_Sec: String(10 + i), Video_Length_Sec: "60" }),
  );
  rows.push(row({ Topic: "tiny", Views: "10", Avg_Watch_Sec: "59", Video_Length_Sec: "60" }));
  const r = rankQuality(rows, "YouTube", "watched", 3);
  assert.equal(r.total, 12);
  assert.deepEqual(r.best.map((x) => x.row.topic), ["c11", "c10", "c9"]);
  assert.deepEqual(r.worst.map((x) => x.row.topic), ["c0", "c1", "c2"]);
  const med = (15 + 16) / 2 / 60;
  assert.ok(Math.abs(r.best[0].index - 21 / 60 / med) < 1e-9);
  assert.equal(lengthVsWatched(rows).length, 12);
});
