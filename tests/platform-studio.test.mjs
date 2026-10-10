import assert from "node:assert/strict";
import test from "node:test";
import { digitalVsTv, facebookReach, hashtagShare, metricOf, platformValues, tagDaily, topTopics, crossDaily, hashtagRanking, strengths, tagDetail, dailySeries, episodeRatings, groupStats, hourMedians, interactionMix, lastDays, reachRings, recentGains, skipStats, topPosts, ytStudio, zoneRatings } from "../lib/dashboard/platformStudio.ts";

const row = (o) => ({
  date: o.date,
  platform: o.platform || "YouTube",
  vdoType: o.vdoType || "Shorts",
  topicType: o.topicType || "",
  topic: o.topic || "",
  episodeId: "",
  url: o.url || "",
  contentId: o.contentId || "",
  hashtags: o.tags || "",
  publishTime: o.time || "",
  views: o.views || 0,
  likes: o.likes || 0,
  comments: o.comments || 0,
  shares: o.shares || 0,
  avgWatchSec: o.watch || 0,
  skipRate: o.skip ?? null,
  ratingTotal: o.rating || 0,
  gmmRating: o.gmm || 0,
  ratingBkk: o.bkk || 0,
  ratingUrban: 0,
  ratingBkkUrban: 0,
  ratingRural: o.rural || 0,
});

test("daily series: every day of the range, posts by publish date, ER of that day's posts", () => {
  const rows = [row({ date: "2026-10-01", views: 1000, likes: 50, shares: 50 }), row({ date: "2026-10-01", views: 1000 }), row({ date: "2026-10-03", views: 500, comments: 5 }), row({ date: "2026-09-30", views: 9 })];
  const s = dailySeries(rows, "2026-10-01", "2026-10-03");
  assert.deepEqual(s.map((d) => [d.date, d.posts, d.views]), [["2026-10-01", 2, 2000], ["2026-10-02", 0, 0], ["2026-10-03", 1, 500]]);
  assert.equal(s[0].er, 100 / 2000);
  assert.equal(s[2].commentsPer1k, 10);
  assert.equal(s[1].er, 0);
});

test("groups: share of posts vs views, median, interaction per 1,000 views; sorted by views", () => {
  const rows = [row({ date: "d", vdoType: "Facebook Reels", views: 800, shares: 8 }), row({ date: "d", vdoType: "Facebook Post", views: 100 }), row({ date: "d", vdoType: "Facebook Post", views: 100, likes: 2 })];
  const [reels, post] = groupStats(rows, (r) => r.vdoType);
  assert.equal(reels.key, "Facebook Reels");
  assert.equal(reels.viewShare, 0.8);
  assert.equal(reels.sharesPer1k, 10);
  assert.equal(post.postShare, 2 / 3);
  assert.equal(post.medianViews, 100);
  assert.equal(post.likesPer1k, 10);
  assert.equal(groupStats([row({ date: "d", topicType: "" })], (r) => r.topicType)[0].key, "ไม่ระบุ");
});

test("interaction mix, rings and top posts", () => {
  const rows = [row({ date: "d", views: 100, likes: 6, comments: 2, shares: 2 }), row({ date: "d", views: 300 })];
  assert.deepEqual(interactionMix(rows), { likes: 6, comments: 2, shares: 2, total: 10 });
  assert.deepEqual(reachRings(rows), { er: 10 / 400, sharedPosts: 0.5, commentedPosts: 0.5 });
  assert.equal(topPosts(rows, 1)[0].views, 300);
});

test("publish hour: median only with enough posts; midnight placeholders are not an hour", () => {
  const rows = [9, 9, 9].map((h, i) => row({ date: "d", time: `0${h}:15`, views: (i + 1) * 100 })).concat([row({ date: "d", time: "10:00", views: 5 }), row({ date: "d", time: "00:00", views: 7 })]);
  const h = hourMedians(rows);
  assert.equal(h[9].medianViews, 200);
  assert.equal(h[10].posts, 1);
  assert.equal(h[10].medianViews, null);
  assert.equal(h[0].posts, 0);
});

test("Instagram skip rate and watch time weighted by views", () => {
  const s = skipStats([row({ date: "d", views: 300, skip: 40, watch: 10 }), row({ date: "d", views: 100, skip: 80, watch: 2 }), row({ date: "d", views: 100 })]);
  assert.equal(s.skip, (40 * 300 + 80 * 100) / 400);
  assert.equal(s.watchSec, (10 * 300 + 2 * 100) / 400);
  assert.equal(s.posts, 2);
  assert.equal(skipStats([]).skip, null);
});

test("YouTube Analytics: watch hours, subscribers, traffic of the clips in the range; retention of the most viewed with a curve", () => {
  const data = {
    updatedAt: "",
    windows: null,
    search: {},
    videos: [
      { id: "AAAAAAAAAAA", views: 3600, avgViewSec: 60, subs: 5, engagedViews: 0, avgViewPct: 0, shares: 0, likes: 0, comments: 0, revenue: 0, adRevenue: 0, grossRevenue: 0, cpm: 0, playbackCpm: 0, monetized: 0, traffic: { SHORTS: 300, YT_SEARCH: 100 } },
      { id: "BBBBBBBBBBB", views: 7200, avgViewSec: 30, subs: 1, engagedViews: 0, avgViewPct: 0, shares: 0, likes: 0, comments: 0, revenue: 0, adRevenue: 0, grossRevenue: 0, cpm: 0, playbackCpm: 0, monetized: 0, traffic: { SHORTS: 600 } },
    ],
    retention: [{ id: "AAAAAAAAAAA", points: [{ at: 0, watch: 1, relative: 0 }, { at: 1, watch: 0.4, relative: 0 }] }],
  };
  const rows = [row({ date: "2026-10-01", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", topic: "ก" }), row({ date: "2026-10-02", url: "https://www.youtube.com/shorts/BBBBBBBBBBB", topic: "ข" }), row({ date: "2026-10-02", url: "https://www.youtube.com/watch?v=CCCCCCCCCCC" })];
  const y = ytStudio(data, rows);
  assert.equal(y.matched, 2);
  assert.equal(y.hours, 60 + 60);
  assert.equal(y.subs, 6);
  assert.deepEqual(y.traffic.map((t) => [t.source, t.views]), [["SHORTS", 900], ["YT_SEARCH", 100]]);
  assert.equal(y.traffic[0].share, 0.9);
  assert.equal(y.retention.id, "AAAAAAAAAAA");
  assert.equal(y.retention.title, "ก");
  const s = dailySeries(rows, "2026-10-01", "2026-10-02", y.byKey);
  assert.deepEqual(s.map((d) => [d.hours, d.subs]), [[60, 5], [60, 1]]);
});

test("growth: views gained per day by the page's posts only; missing days flagged", () => {
  const days = new Map([
    ["2026-10-08", [["YouTube|A", 100, 0, 0, 0, 0], ["YouTube|B", 50, 0, 0, 0, 0], ["TikTok|X", 999, 0, 0, 0, 0]]],
    ["2026-10-09", null],
    ["2026-10-10", [["YouTube|B", 200, 0, 0, 0, 0]]],
  ]);
  const order = lastDays("2026-10-10", 3);
  assert.deepEqual(order, ["2026-10-08", "2026-10-09", "2026-10-10"]);
  const g = recentGains(days, new Set(["YouTube|A", "YouTube|B"]), order);
  assert.deepEqual(g.series.map((d) => [d.views, d.missing]), [[150, false], [0, true], [200, false]]);
  assert.equal(g.total, 350);
  assert.deepEqual(g.top, [{ key: "YouTube|B", views: 250 }, { key: "YouTube|A", views: 100 }]);
});

test("TV: episode ratings per channel by date with the average; areas for One31", () => {
  const rows = [row({ platform: "TV", date: "2026-10-02", rating: 1.2, gmm: 0.4, bkk: 2 }), row({ platform: "TV", date: "2026-10-01", rating: 0.8, bkk: 1, rural: 0.5 }), row({ platform: "TV", date: "2026-10-03" })];
  const one = episodeRatings(rows, "One31");
  assert.deepEqual(one.list.map((x) => x.date), ["2026-10-01", "2026-10-02"]);
  assert.equal(one.avg, 1);
  assert.equal(episodeRatings(rows, "GMM25").list.length, 1);
  const z = zoneRatings(rows);
  assert.equal(z[0].rating, 1.5);
  assert.equal(z[1].rating, null);
  assert.equal(z[3].rating, 0.5);
});

test("Cross Platform: views per day per platform, missing days 0, TV left out", () => {
  const rows = [row({ date: "2026-10-01", platform: "YouTube", views: 5 }), row({ date: "2026-10-01", platform: "TikTok", views: 7 }), row({ date: "2026-10-02", platform: "TV", views: 99 })];
  const d = crossDaily(rows, "2026-10-01", "2026-10-02");
  assert.deepEqual(d[0], { date: "2026-10-01", YouTube: 5, TikTok: 7, Facebook: 0, Instagram: 0 });
  assert.deepEqual(d[1], { date: "2026-10-02", YouTube: 0, TikTok: 0, Facebook: 0, Instagram: 0 });
});

test("strengths: each axis as a share of the best platform", () => {
  const rows = [row({ date: "d", platform: "YouTube", views: 1000, shares: 10 }), row({ date: "d", platform: "TikTok", views: 500, shares: 10 }), row({ date: "d", platform: "TikTok", views: 500 })];
  const s = strengths(rows);
  const views = s.radar.find((a) => a.axis === "วิวรวม");
  assert.equal(views.YouTube, 1);
  assert.equal(views.TikTok, 1);
  assert.equal(s.radar.find((a) => a.axis === "จำนวนโพสต์").YouTube, 0.5);
  assert.equal(s.radar.find((a) => a.axis === "แชร์ / 1K วิว").TikTok, 1);
  assert.equal(views.Facebook, 0);
});

test("hashtag ranking: channel tags hidden, rank move against the period before, detail", () => {
  const hidden = new Set(["#ถกไม่เถียง"]);
  const cur = [row({ date: "d", platform: "YouTube", views: 10, tags: "#a #b #ถกไม่เถียง" }), row({ date: "d", platform: "TikTok", views: 30, tags: "#a #b" }), row({ date: "d", platform: "TikTok", views: 5, tags: "#a" }), row({ date: "d", platform: "YouTube", views: 1, tags: "#c" })];
  const prev = [row({ date: "p", tags: "#b" }), row({ date: "p", tags: "#b" }), row({ date: "p", tags: "#b #a" }), row({ date: "p", tags: "#a" })];
  const r = hashtagRanking(cur, prev, hidden);
  assert.deepEqual(r.map((x) => [x.tag, x.rank, x.move]), [["#a", 1, 1], ["#b", 2, -1]]);
  assert.equal(r[0].views, 45);
  assert.equal(hashtagRanking(cur, [], hidden)[0].move, null);
  const d = tagDetail(r[0], hidden);
  assert.deepEqual(d.byPlatform.find((x) => x.platform === "TikTok"), { platform: "TikTok", posts: 2, views: 35 });
  assert.deepEqual(d.together, [{ tag: "#b", posts: 2 }]);
});

test("page metric: views, posts and ER per platform and per topic type", () => {
  const rows = [row({ date: "2026-10-01", platform: "YouTube", views: 100, likes: 10, topicType: "ข่าวการเมือง" }), row({ date: "2026-10-02", platform: "TikTok", views: 300, topicType: "ข่าวการเมือง" }), row({ date: "2026-10-02", platform: "TikTok", views: 50, topicType: "บันเทิง" }), row({ date: "2026-10-02", platform: "TV", views: 999 })];
  assert.equal(metricOf(rows.slice(0, 1), "er"), 0.1);
  assert.deepEqual(platformValues(rows, "views").slice(0, 2), [{ platform: "TikTok", value: 350 }, { platform: "YouTube", value: 100 }]);
  assert.deepEqual(platformValues(rows, "posts")[0], { platform: "TikTok", value: 2 });
  assert.deepEqual(topTopics(rows, "views").map((x) => [x.topic, x.value]), [["ข่าวการเมือง", 400], ["บันเทิง", 50]]);
  assert.equal(topTopics(rows, "er").length, 0); // fewer than 5 posts: no ER ranking
});

test("Digital vs TV per day; Facebook reach and clicks; hashtag share; tag 7-day line", () => {
  const tv = { ...row({ date: "2026-10-02", platform: "TV" }), audienceTotal: 5000 };
  const d = digitalVsTv([row({ date: "2026-10-01", views: 70 }), tv], "2026-10-01", "2026-10-02");
  assert.deepEqual(d, [{ date: "2026-10-01", digital: 70, tv: 0 }, { date: "2026-10-02", digital: 0, tv: 5000 }]);
  const fb = [{ ...row({ date: "d", platform: "Facebook" }), impressions: 900, linkClicks: 12 }, { ...row({ date: "d", platform: "Facebook" }), impressions: 0, linkClicks: null }];
  assert.deepEqual(facebookReach(fb), { impressions: 900, impressionPosts: 1, linkClicks: 12, clickPosts: 1 });
  assert.equal(hashtagShare([row({ date: "d", tags: "#a" }), row({ date: "d" })]), 0.5);
  const t = { tag: "#a", rows: [row({ date: "2026-10-09", views: 5 }), row({ date: "2026-10-10", views: 7 }), row({ date: "2026-09-01", views: 99 })] };
  assert.deepEqual(tagDaily(t, "2026-10-10", 3), [0, 5, 7]);
});
