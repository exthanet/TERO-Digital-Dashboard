import assert from "node:assert/strict";
import test from "node:test";
import { engageTotals, platformEngage, talkClip, topEngaged, topicEngage } from "../lib/dashboard/engagementReport.ts";

const row = (o) => ({ platform: "YouTube", topic: "", topicType: "", url: "", views: 0, likes: 0, comments: 0, ...o });

test("totals: digital only, per 1,000 views", () => {
  const t = engageTotals([row({ views: 2000, likes: 40, comments: 6 }), row({ platform: "TV", views: 9e6, likes: 9 })]);
  assert.deepEqual(t, { posts: 1, views: 2000, likes: 40, comments: 6, likesPer1k: 20, commentsPer1k: 3 });
  assert.equal(engageTotals([]).likesPer1k, null);
});

test("top clips by likes or comments, ties by views, zeros left out", () => {
  const rows = [row({ topic: "a", likes: 5, views: 10 }), row({ topic: "b", likes: 5, views: 99 }), row({ topic: "c", likes: 0, comments: 3 })];
  assert.deepEqual(topEngaged(rows, "likes").map((r) => r.topic), ["b", "a"]);
  assert.deepEqual(topEngaged(rows, "comments").map((r) => r.topic), ["c"]);
});

test("platforms with posts only; topic types need 5 posts", () => {
  assert.deepEqual(platformEngage([row({ views: 1000, likes: 10 })]).map((p) => p.platform), ["YouTube"]);
  const many = Array.from({ length: 5 }, () => row({ topicType: "ข่าวการเมือง", views: 100, comments: 1 }));
  const t = topicEngage([...many, row({ topicType: "อื่น", likes: 999 })]);
  assert.deepEqual(t.map((x) => [x.topicType, x.posts, x.commentsPer1k]), [["ข่าวการเมือง", 5, 10]]);
});

test("talk clip: most comments per view among clips at or above the platform median", () => {
  const rows = [
    row({ topic: "tiny", views: 10, comments: 5 }),
    row({ topic: "mid", views: 1000, comments: 20 }),
    row({ topic: "big", views: 5000, comments: 50 }),
  ];
  const t = talkClip(rows);
  assert.equal(t.row.topic, "mid");
  assert.equal(t.commentsPer1k, 20);
});
