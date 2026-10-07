import assert from "node:assert/strict";
import test from "node:test";
import { OTHERS, monthsOf, programDetail, programTable } from "../lib/dashboard/programReport.ts";

const row = (program, date, views, o = {}) => ({ program, date, views, likes: 1, comments: 1, shares: 0, platform: "TikTok", topicType: "ข่าวการเมือง", hashtags: "", ratingTotal: 0, audienceTotal: 0, ...o });

test("programs side by side: share, growth, small ones folded into อื่นๆ, TV apart", () => {
  const cur = { start: "2026-09-01", end: "2026-09-30" };
  const prev = { start: "2026-08-01", end: "2026-08-31" };
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row("A", "2026-09-0" + (i + 1), 100)),
    ...Array.from({ length: 5 }, () => row("B", "2026-09-10", 40, { platform: "YouTube" })),
    row("C", "2026-09-11", 10), row("D", "2026-09-12", 30),
    row("A", "2026-08-15", 300),
    row("A", "2026-09-05", 0, { platform: "TV", ratingTotal: 0.4, audienceTotal: 280000 }),
  ];
  const t = programTable(rows, cur, prev);
  assert.deepEqual(t.lines.map((l) => l.program), ["A", "B", OTHERS]);
  const a = t.lines[0];
  assert.equal(a.posts, 6);
  assert.equal(a.views, 600);
  assert.equal(a.growth, 1);
  assert.equal(a.share, 600 / 840);
  assert.deepEqual(a.tv, { episodes: 1, rating: 0.4, audience: 280000 });
  assert.deepEqual(t.lines[2].members, ["C", "D"]);
  assert.equal(t.lines[2].views, 40);
  assert.equal(t.total.views, 840);
  assert.deepEqual(t.lines[1].platforms, { YouTube: 200 });
});

test("detail: top clips, topic types by median, hashtags without channel tags", () => {
  const cur = { start: "2026-09-01", end: "2026-09-30" };
  const rows = [
    row("A", "2026-09-01", 500, { hashtags: "#ถกไม่เถียง #a", topicType: "X" }),
    row("A", "2026-09-02", 300, { hashtags: "#a", topicType: "X" }),
    row("A", "2026-09-03", 100, { topicType: "X" }),
    row("A", "2026-09-04", 50, { topicType: "Y" }),
  ];
  const d = programDetail(rows, ["A"], cur);
  assert.equal(d.top[0].views, 500);
  assert.deepEqual(d.topics, [{ topicType: "X", posts: 3, medianViews: 300 }]);
  assert.deepEqual(d.hashtags, [{ tag: "#a", posts: 2, views: 800 }]);
  assert.deepEqual(monthsOf({ start: "2025-11-15", end: "2026-01-02" }), ["2025-11", "2025-12", "2026-01"]);
});
