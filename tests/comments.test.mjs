import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PER_LIST, collectComments, commentDocId, facebookFromInbox, hasContent, mergeLatest, youtubeComments } from "../lib/integrations/commentsCollect.ts";

const thread = (id, text, likes, at, name = `ผู้ชม ${id}`) => ({
  id: `t${id}`,
  snippet: { topLevelComment: { id: `c${id}`, snippet: { authorDisplayName: name, authorProfileImageUrl: `https://yt3.example/${id}.jpg`, textOriginal: text, likeCount: likes, publishedAt: at } } },
});
const ytFetch = (byOrder, calls = []) => async (url) => {
  const u = new URL(url);
  calls.push(u.searchParams.get("order"));
  assert.equal(u.searchParams.get("maxResults"), "100");
  const items = byOrder[u.searchParams.get("order")];
  if (items === "disabled") return new Response(JSON.stringify({ error: { errors: [{ reason: "commentsDisabled" }] } }), { status: 403 });
  if (items === "quota") return new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }), { status: 403 });
  return new Response(JSON.stringify({ items }));
};

test("content filter: emoji, marks and one-word noise are not 'latest' comments", () => {
  assert.equal(hasContent("😂😂😂"), false);
  assert.equal(hasContent("!!!  ..."), false);
  assert.equal(hasContent("ดี"), false);
  assert.equal(hasContent("ดีมากครับ 👍"), true);
  assert.equal(hasContent("good job"), true);
});

test("YouTube: most liked sorted by likes, newest filtered and newest first, links to the comment", async () => {
  const calls = [];
  const fetcher = ytFetch({
    relevance: [thread(1, "ดีมาก", 5, "2026-10-01T00:00:00Z"), thread(2, "ข้อมูลแน่น", 50, "2026-10-02T00:00:00Z"), thread(3, "ชอบช่วงท้าย", 20, "2026-10-03T00:00:00Z")],
    time: [thread(4, "😂😂", 0, "2026-10-09T00:00:00Z"), thread(5, "รอตอนต่อไปครับ", 1, "2026-10-08T00:00:00Z"), thread(6, "ขอคลิปเต็มด้วย", 0, "2026-10-09T05:00:00Z")],
  }, calls);
  const c = await youtubeComments("KEY", "AAAAAAAAAAA", 321, fetcher);
  assert.deepEqual(calls, ["relevance", "time"]);
  assert.deepEqual(c.top.map((x) => x.likes), [50, 20, 5]);
  assert.deepEqual(c.latest.map((x) => x.id), ["c6", "c5"]);
  assert.equal(c.top[0].name, "ผู้ชม 2");
  assert.equal(c.top[0].avatar, "https://yt3.example/2.jpg");
  assert.equal(c.top[0].link, "https://www.youtube.com/watch?v=AAAAAAAAAAA&lc=c2");
  assert.equal(c.total, 321);
});

test("YouTube: comments turned off = nothing stored; a quota error stops the step without the key in the message", async () => {
  assert.equal(await youtubeComments("KEY", "BBBBBBBBBBB", 0, ytFetch({ relevance: "disabled" })), null);
  await assert.rejects(youtubeComments("SECRETKEY", "BBBBBBBBBBB", 0, ytFetch({ relevance: "quota" })), (e) => /quotaExceeded/.test(e.message) && !/SECRETKEY/.test(e.message));
});

test("Facebook (Metricool Inbox): grouped by post from the post link; no like counts", () => {
  const t = (post, id, text, at) => ({
    id: `th${id}`,
    participants: [{ id: `u${id}`, name: `คน ${id}`, imageProfileUrl: `https://fb.example/${id}.jpg` }],
    root: { id: `cm${id}`, creationDate: at, text, properties: { permalink: `https://www.facebook.com/${post}?comment_id=${id}` }, element: { id: `page_${post}`, link: `https://www.facebook.com/page/posts/${post}`, commentCount: 40 } },
  });
  const g = facebookFromInbox([t("123456789012", 1, "เห็นด้วยครับ", "2026-10-09T14:48:49+0200"), t("123456789012", 2, "ขอคลิปเต็ม", "2026-10-10T09:05:23+0200"), t("999999999999", 3, "", "2026-10-10T09:05:23+0200")]);
  assert.deepEqual([...g.keys()], ["123456789012"]);
  const post = g.get("123456789012");
  assert.equal(post.items.length, 2);
  assert.equal(post.items[0].likes, null);
  assert.equal(post.items[0].at, "2026-10-09T12:48:49.000Z");
  assert.equal(post.items[1].name, "คน 2");
  assert.equal(post.total, 40);
});

test("Facebook: kept + new comments, one per id, newest first, 30 days, capped", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const c = (id, at, text = "ข้อความมีเนื้อหา") => ({ id, name: "x", avatar: "", text, likes: null, at, link: "" });
  const merged = mergeLatest([c("a", "2026-10-01T00:00:00Z"), c("old", "2026-08-01T00:00:00Z")], [c("a", "2026-10-01T00:00:00Z"), c("b", "2026-10-09T00:00:00Z"), c("noise", "2026-10-09T01:00:00Z", "👍👍")], now);
  assert.deepEqual(merged.map((x) => x.id), ["b", "a"]);
  const many = Array.from({ length: MAX_PER_LIST + 30 }, (_, i) => c(`n${i}`, new Date(now.getTime() - i * 60000).toISOString()));
  assert.equal(mergeLatest([], many, now).length, MAX_PER_LIST);
});

test("sync step: the most viewed YouTube clips of 30 days, stops at the first quota error, cleans up names only", async () => {
  const written = new Map();
  const db = {
    set: async (path, fields) => written.set(path, fields),
    get: async () => null,
    listStamps: async () => [{ name: "x/comments/YouTube_OLD", updateTime: "2026-08-01T00:00:00Z" }, { name: "x/comments/YouTube_NEW", updateTime: "2026-10-09T00:00:00Z" }],
    delete: async (p) => written.set(`deleted:${p}`, true),
    listRaw: async () => { throw new Error("cleanup must not download documents"); },
  };
  const clips = [
    { platform: "YouTube", id: "AAAAAAAAAAA", date: "2026-10-05", views: 900, comments: 10 },
    { platform: "YouTube", id: "BBBBBBBBBBB", date: "2026-10-06", views: 500, comments: 4 },
    { platform: "YouTube", id: "CCCCCCCCCCC", date: "2026-08-01", views: 99999, comments: 50 }, // older than 30 days
    { platform: "YouTube", id: "DDDDDDDDDDD", date: "2026-10-07", views: 800, comments: 0 }, // no comments
    { platform: "Facebook", id: "123456789012", date: "2026-10-07", views: 800, comments: 3 },
  ];
  const asked = [];
  const fetcher = async (url) => {
    const id = new URL(url).searchParams.get("videoId");
    asked.push(id);
    if (id === "BBBBBBBBBBB") return new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }), { status: 403 });
    return new Response(JSON.stringify({ items: [thread(1, "ดีมากครับ", 3, "2026-10-08T00:00:00Z")] }));
  };
  const got = await collectComments(db, clips, { today: "2026-10-10", youtubeKey: "KEY", facebookBlogs: [], fetcher, now: new Date("2026-10-10T00:00:00Z") });
  assert.deepEqual([...new Set(asked)], ["AAAAAAAAAAA", "BBBBBBBBBBB"]);
  assert.equal(got.youtube, 1);
  assert.match(got.problems[0], /quotaExceeded/);
  assert.ok(written.has(`comments/${commentDocId("YouTube", "AAAAAAAAAAA")}`));
  assert.ok(written.has("deleted:comments/YouTube_OLD"));
  assert.ok(!written.has("deleted:comments/YouTube_NEW"));
  assert.equal(got.removed, 1);
});
