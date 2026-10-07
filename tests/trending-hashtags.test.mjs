import assert from "node:assert/strict";
import test from "node:test";
import { creativeCenterUrl, hashtagDetail, periodsEnding, trendingHashtags } from "../lib/dashboard/trendingHashtags.ts";

const row = (date, views, hashtags, o = {}) => ({ date, views, likes: 1, comments: 1, shares: 0, hashtags, platform: "TikTok", program: "ถกไม่เถียง", topicType: "ข่าวการเมือง", ...o });

test("periods: n days ending on a day, and the n days before", () => {
  assert.deepEqual(periodsEnding("2026-10-07", 7), { cur: { start: "2026-10-01", end: "2026-10-07" }, prev: { start: "2026-09-24", end: "2026-09-30" } });
});

test("ranking by views of the period's posts, rank change, new tags, channel tag hidden", () => {
  const { cur, prev } = periodsEnding("2026-10-07", 7);
  const rows = [
    // Current period: #a 300 views (2 posts), #b 500 (2 posts), #c 1 post (below min), #show on every post.
    row("2026-10-02", 100, "#show #a"), row("2026-10-03", 200, "#show #a"),
    row("2026-10-04", 250, "#show #b", { platform: "YouTube" }), row("2026-10-05", 250, "#show #b"),
    row("2026-10-06", 999, "#show #c"),
    ...Array.from({ length: 6 }, (_, i) => row("2026-10-07", 1, "#show")),
    // Period before: #a ranked 1 with 600 views, #b not there.
    row("2026-09-25", 300, "#a"), row("2026-09-26", 300, "#a"),
    row("2026-09-27", 5, "#z"), row("2026-09-28", 5, "#z"),
  ];
  const t = trendingHashtags(rows, cur, prev);
  assert.deepEqual(t.hidden, ["#show"]);
  assert.deepEqual(t.items.map((x) => [x.tag, x.rank, x.prevRank]), [["#b", 1, null], ["#a", 2, 1]]);
  const a = t.items[1];
  assert.equal(a.posts, 2);
  assert.equal(a.growth, (300 - 600) / 600);
  assert.equal(a.daily.length, 7);
  assert.equal(a.daily[1], 100);
  assert.deepEqual(t.items[0].platforms, { YouTube: 250, TikTok: 250 });
  assert.equal(trendingHashtags(rows, cur, prev, { hideCommon: false }).items[0].tag, "#show");
});

test("detail: totals, per day, platforms, related tags; Creative Center link", () => {
  const { cur } = periodsEnding("2026-10-07", 7);
  const rows = [row("2026-10-02", 100, "#a #x"), row("2026-10-03", 200, "#a #x #y", { platform: "Facebook" }), row("2026-10-03", 50, "#b")];
  const d = hashtagDetail(rows, "#a", cur);
  assert.equal(d.totals.posts, 2);
  assert.equal(d.totals.views, 300);
  assert.deepEqual(d.daily.find((x) => x.date === "2026-10-03"), { date: "2026-10-03", posts: 1, views: 200 });
  assert.deepEqual(d.related, [{ tag: "#x", posts: 2 }, { tag: "#y", posts: 1 }]);
  assert.equal(d.byPlatform[0].name, "Facebook");
  assert.ok(creativeCenterUrl("#ถกไม่เถียง").includes(encodeURIComponent("ถกไม่เถียง")));
});
