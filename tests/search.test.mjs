import assert from "node:assert/strict";
import test from "node:test";
import { matchesSearch, searchByMonth, searchSummary, searchTerms } from "../lib/dashboard/search.ts";

const row = (o) => ({ topic: "", program: "ถกไม่เถียง", channel: "TERO Digital", hashtags: "", platform: "TikTok", date: "2026-09-01", views: 0, likes: 0, comments: 0, shares: 0, audienceTotal: 0, ...o });

test("terms: commas, # and case do not matter", () => {
  assert.deepEqual(searchTerms(" #BuddyDean , บัดดี้ดีน,, "), ["buddydean", "บัดดี้ดีน"]);
  assert.deepEqual(searchTerms(""), []);
});

test("match: title or hashtags (from the caption / description), any of the terms", () => {
  const inTitle = row({ topic: "คลิป #BuddyDean" });
  const inTags = row({ topic: "ไม่มีในชื่อ", hashtags: "#ถกไม่เถียง #buddydean" });
  const thai = row({ topic: "#บัดดี้ดีน" });
  const other = row({ topic: "อื่นๆ" });
  const t = searchTerms("buddydean, บัดดี้ดีน");
  assert.deepEqual([inTitle, inTags, thai, other].map((r) => matchesSearch(r, t)), [true, true, true, false]);
  assert.equal(matchesSearch(other, []), true);
});

test("summary: per platform with likes, comments, shares and ER; TV apart; by month", () => {
  const rows = [
    row({ platform: "TikTok", views: 1000, likes: 50, comments: 5, shares: 5 }),
    row({ platform: "TikTok", views: 1000, likes: 30, comments: 5, shares: 5, date: "2026-10-02" }),
    row({ platform: "Facebook", views: 500, likes: 10, comments: 10 }),
    row({ platform: "TV", views: 0, audienceTotal: 700000 }),
  ];
  const s = searchSummary(rows);
  assert.deepEqual(s.lines.map((l) => [l.platform, l.posts, l.likes, l.comments]), [["TikTok", 2, 80, 10], ["Facebook", 1, 10, 10]]);
  assert.equal(s.total.views, 2500);
  assert.equal(s.total.er, 120 / 2500);
  assert.deepEqual(s.tv, { episodes: 1, audience: 700000 });
  assert.deepEqual(searchByMonth(rows).map((m) => [m.month, m.posts]), [["2026-09", 2], ["2026-10", 1]]);
});
