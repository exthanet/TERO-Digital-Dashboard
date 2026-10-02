import assert from "node:assert/strict";
import test from "node:test";
import { mapPost, rowKey } from "../lib/integrations/metricoolSync.ts";
import { apiCoversAccount, compareSources, listVideos, mapTikTokVideo } from "../lib/integrations/tiktokApi.ts";

const TERO = { blogId: 1, label: "TERO Digital", mode: "multi", enabled: true };
const video = {
  id: "7689781312269356294",
  create_time: Date.parse("2026-09-26T09:58:58Z") / 1000,
  title: "คลิปสั้น #ถกไม่เถียง",
  video_description: "คลิปสั้น #ถกไม่เถียง",
  duration: 45,
  share_url: "https://www.tiktok.com/@terodigital/video/7689781312269356294",
  view_count: 1245,
  like_count: 5,
  comment_count: 0,
  share_count: 1,
};

test("an API video maps exactly like the same post from Metricool", () => {
  const fromApi = mapTikTokVideo(video, TERO);
  const fromMetricool = mapPost("tiktok", {
    videoId: video.id, shareUrl: video.share_url, videoDescription: video.video_description, title: video.title,
    createTime: "2026-09-26T11:58:58+0200", viewCount: 1245, likeCount: 5, commentCount: 0, shareCount: 1, duration: 45,
  }, TERO);
  assert.deepEqual(fromApi, fromMetricool);
  assert.equal(rowKey(fromApi), "TikTok|7689781312269356294");
  assert.equal(fromApi.Date, "2026-09-26");
  assert.equal(fromApi.Publish_Time, "16:58"); // Bangkok
  assert.equal(fromApi.Views, "1245");
  assert.equal(fromApi.Program, "ถกไม่เถียง");
});

test("compare: matched posts, median view difference, posts on one side only", () => {
  const row = (id, views) => mapTikTokVideo({ ...video, id, share_url: `https://www.tiktok.com/@t/video/${id}`, view_count: views }, TERO);
  const api = [row("7000000000000000001", 110), row("7000000000000000002", 200), row("7000000000000000003", 50)];
  const mc = [row("7000000000000000001", 100), row("7000000000000000002", 200), row("7000000000000000009", 70)];
  const c = compareSources(api, mc);
  assert.deepEqual({ ...c, medianViewDiff: Math.round(c.medianViewDiff * 1000) / 1000 }, {
    apiVideos: 3, metricoolPosts: 3, matched: 2, medianViewDiff: 0.1, onlyApi: 1, onlyMetricool: 1,
  });
});

test("the API is used only when it covers at least 80% of Metricool's posts", () => {
  assert.equal(apiCoversAccount({ apiVideos: 1280, metricoolPosts: 1171 }), true);
  assert.equal(apiCoversAccount({ apiVideos: 900, metricoolPosts: 1171 }), false); // 77%: a lost permission
  assert.equal(apiCoversAccount({ apiVideos: 0, metricoolPosts: 0 }), false);
  assert.equal(apiCoversAccount({ apiVideos: 5, metricoolPosts: 0 }), true); // a new account Metricool lacks
});

test("listVideos pages until the window starts and waits out rate limits", async () => {
  const pages = [
    { error: { code: "rate_limit_exceeded" } },
    { data: { videos: [{ id: "a", create_time: 300 }, { id: "b", create_time: 250 }], has_more: true, cursor: 7 }, error: { code: "ok" } },
    { data: { videos: [{ id: "c", create_time: 200 }, { id: "d", create_time: 100 }], has_more: true, cursor: 8 }, error: { code: "ok" } },
    { data: { videos: [{ id: "never", create_time: 50 }], has_more: false }, error: { code: "ok" } },
  ];
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => pages.shift() };
  };
  const waits = [];
  try {
    const videos = await listVideos("token", 150, () => undefined, async (ms) => waits.push(ms));
    assert.deepEqual(videos.map((v) => v.id), ["a", "b", "c"]); // d is older than the window; no third page
    assert.deepEqual(bodies, [{ max_count: 20 }, { max_count: 20 }, { max_count: 20, cursor: 7 }]);
    assert.deepEqual(waits, [15000, 1000]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("TikTok's temporary errors are retried before giving up", async () => {
  const responses = [
    { ok: true, status: 200, body: { data: { videos: [{ id: "a", create_time: 300 }], has_more: true, cursor: 1 }, error: { code: "ok" } } },
    { ok: false, status: 500, body: { error: { code: "internal_error", message: "Something went wrong" } } },
    { throws: true },
    { ok: true, status: 200, body: { data: { videos: [{ id: "b", create_time: 200 }], has_more: false }, error: { code: "ok" } } },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const r = responses.shift();
    if (r.throws) throw new Error("socket hang up");
    return { ok: r.ok, status: r.status, json: async () => r.body };
  };
  const waits = [];
  try {
    const videos = await listVideos("token", 100, () => undefined, async (ms) => waits.push(ms));
    assert.deepEqual(videos.map((v) => v.id), ["a", "b"]);
    assert.deepEqual(waits, [1000, 5000, 10000]);
  } finally {
    globalThis.fetch = realFetch;
  }
  // Still failing after 5 retries: give up (the sync then falls back to keeping the numbers).
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { code: "internal_error", message: "x" } }) });
  try {
    await assert.rejects(listVideos("token", 100, () => undefined, async () => undefined), /internal_error/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
