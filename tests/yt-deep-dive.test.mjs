import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { formatOf, groupBy, joinVideos, keywordRelevance, quadrants, searchGaps } from "../lib/dashboard/ytDeepDive.ts";
import { collectYtAnalytics } from "../lib/integrations/ytAnalyticsCollect.ts";

const v = (id, extra = {}) => ({ id, views: 1000, engagedViews: 500, avgViewSec: 30, avgViewPct: 80, subs: 2, shares: 3, likes: 40, comments: 7, revenue: 1, adRevenue: 0, grossRevenue: 0, cpm: 0, playbackCpm: 0, monetized: 0, ...extra });
const row = (id, vdo, topic = "หัวข้อ", topicType = "ข่าวการเมือง") =>
  normalize({ Date: "2026-09-10", Program: "ถกไม่เถียง", Topic: topic, Topic_Type: topicType, Platform: "YouTube", VDO_Type: vdo, URL: `https://www.youtube.com/watch?v=${id}` });

test("formats from the VDO Type", () => {
  assert.equal(formatOf("Youtube shorts"), "Shorts");
  assert.equal(formatOf("LIVE"), "Live");
  assert.equal(formatOf("Video Episode"), "Video");
});

test("join by URL id; hook rate only for Shorts; RPM per 1,000 views", () => {
  const data = { updatedAt: "", videos: [v("aaaaaaaaaaa", { views: 2000, engagedViews: 1500, revenue: 4 }), v("bbbbbbbbbbb")], windows: null, retention: [], search: {} };
  const items = joinVideos(data, [row("aaaaaaaaaaa", "Shorts"), row("bbbbbbbbbbb", "Video Episode"), row("ccccccccccc", "Shorts")]);
  assert.equal(items.length, 2);
  assert.equal(items[0].hookRate, 0.75);
  assert.equal(items[0].rpm, 2);
  assert.equal(items[1].hookRate, null);
  assert.equal(items[1].er, 50 / 1000);
});

test("Shorts quadrants against the Shorts' medians; groups add up", () => {
  const data = {
    updatedAt: "", windows: null, retention: [], search: {},
    videos: [
      v("aaaaaaaaaaa", { engagedViews: 800, avgViewPct: 120 }),
      v("bbbbbbbbbbb", { engagedViews: 800, avgViewPct: 40 }),
      v("ccccccccccc", { engagedViews: 200, avgViewPct: 120 }),
      v("ddddddddddd", { engagedViews: 200, avgViewPct: 40 }),
    ],
  };
  const items = joinVideos(data, ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"].map((id) => row(id, "Shorts")));
  const q = quadrants(items);
  assert.equal(q.medianHook, 0.5);
  assert.deepEqual(Object.fromEntries(q.items.map((x) => [x.v.id[0], x.quadrant])), { a: "formula", b: "weakBody", c: "weakHook", d: "drop" });
  const g = groupBy(items, (x) => x.format)[0];
  assert.equal(g.views, 4000);
  assert.equal(g.rpm, 1);
  assert.equal(g.commentsPer1k, 7);
});

test("keyword relevance and search gaps", () => {
  const terms = [{ term: "data center", views: 100 }, { term: "ถกไม่เถียง", views: 300 }];
  assert.equal(keywordRelevance("แฉ Data Center ซุกน้ำมัน", terms), 0.25);
  assert.equal(keywordRelevance("อะไรก็ได้", []), null);
  assert.deepEqual(searchGaps([{ term: "ถกไม่เถียง ล่าสุด", views: 9 }, { term: "มวยวันลุมพินี", views: 5 }, { term: "data center", views: 3 }], ["แฉ Data Center"]), [{ term: "มวยวันลุมพินี", views: 5 }]);
});

test("collector: per-video numbers, traffic, windows, retention and search from the API", async () => {
  const reply = (cols, rows) => ({ ok: true, status: 200, json: async () => ({ columnHeaders: cols.map((name) => ({ name })), rows }) });
  const fake = async (url) => {
    const p = new URL(url).searchParams;
    const metrics = p.get("metrics"), dims = p.get("dimensions"), filters = p.get("filters");
    if (dims === "video" && metrics.startsWith("views,engagedViews")) return reply(["video", ...metrics.split(",")], [["aaaaaaaaaaa", 100, 60, 30, 90, 1, 2, 10, 3]]);
    if (dims === "video" && metrics.startsWith("estimatedRevenue")) return reply(["video", ...metrics.split(",")], [["aaaaaaaaaaa", 1.5, 1, 2, 3, 4, 50]]);
    if (dims === "video,insightTrafficSourceType") return reply(["video", "insightTrafficSourceType", "views"], [["aaaaaaaaaaa", "YT_SEARCH", 40], ["aaaaaaaaaaa", "SHORTS", 60]]);
    if (dims === "insightTrafficSourceType") return reply(["insightTrafficSourceType", "views"], [["SHORTS", 900]]);
    if (dims === "insightTrafficSourceDetail" && filters.startsWith("channel")) return reply(["insightTrafficSourceDetail", "views"], [["ถกไม่เถียง", 50]]);
    if (dims === "insightTrafficSourceDetail") return reply(["insightTrafficSourceDetail", "views"], [["data center", 12]]);
    if (dims === "creatorContentType") return reply(["creatorContentType", "views", "estimatedRevenue"], [["shorts", 900, 0.4]]);
    if (dims === "elapsedVideoTimeRatio") return reply(["elapsedVideoTimeRatio", "audienceWatchRatio", "relativeRetentionPerformance"], [[0.01, 1.2345, 0.7], [0.02, 1.1, 0.68]]);
    throw new Error("unexpected " + url);
  };
  const d = await collectYtAnalytics("t", "owner", "UC1", ["aaaaaaaaaaa", "YT-bad"], "2026-10-05", "2026-08-01", async () => {}, fake);
  assert.equal(d.videos.length, 1);
  assert.deepEqual({ ...d.videos[0], traffic: undefined }, { id: "aaaaaaaaaaa", views: 100, engagedViews: 60, avgViewSec: 30, avgViewPct: 90, subs: 1, shares: 2, likes: 10, comments: 3, revenue: 1.5, adRevenue: 1, grossRevenue: 2, cpm: 3, playbackCpm: 4, monetized: 50, traffic: undefined });
  assert.deepEqual(d.videos[0].traffic, { YT_SEARCH: 40, SHORTS: 60 });
  assert.deepEqual(d.windows.d28.contentType, [{ type: "shorts", views: 900, revenue: 0.4 }]);
  assert.equal(d.windows.d28.end, "2026-10-03");
  assert.deepEqual(d.retention[0].points[0], { at: 0.01, watch: 1.235, relative: 0.7 });
  assert.deepEqual(d.search.aaaaaaaaaaa, [{ term: "data center", views: 12 }]);
});
