import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthlyReport, lastFullMonth, monthLabel, monthPeriod, previousMonth } from "../lib/dashboard/monthlyReport.ts";

const base = { program: "ถกไม่เถียง", episodeId: "", topic: "", topicType: "ข่าวการเมือง", vdoType: "TikTok", channel: "", province: "", contentId: "", url: "", durationMin: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0, ratingTotal: 0, ratingBkk: 0, ratingUrban: 0, ratingBkkUrban: 0, ratingRural: 0, audienceTotal: 0, gmmRating: 0, gmmAudience: 0, bestOfMonth: "", uploadCount: 1, revenue: 0, publishTime: "", hashtags: "", avgWatchSec: 0, videoLengthSec: 0, skipRate: null, clicks: null, linkClicks: null, impressions: 0 };
const post = (date, platform, views, o = {}) => ({ ...base, date, platform, views, topic: `clip ${date} ${views}`, ...o });
const episode = (date, one, gmm, topic) => ({ ...base, date, platform: "TV", vdoType: "TV", views: 0, topic, ratingTotal: one, audienceTotal: one * 700000, gmmRating: gmm, gmmAudience: gmm * 700000 });
const meta = { createdAt: "2026-10-08T00:00:00Z", createdBy: "admin", dataAt: "2026-10-08" };

test("month helpers", () => {
  assert.deepEqual(monthPeriod("2026-09"), { month: "2026-09", start: "2026-09-01", end: "2026-09-30" });
  assert.equal(monthPeriod("2028-02").end, "2028-02-29");
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(monthLabel("2026-09"), "กันยายน 2026");
  assert.equal(lastFullMonth("2026-10-08"), "2026-09");
  assert.equal(lastFullMonth("2026-09-30"), "2026-09");
});

test("online numbers are the month's posts only, against the month before; TV is kept apart", () => {
  const rows = [
    post("2026-09-02", "TikTok", 1000, { likes: 80, comments: 10, shares: 10 }),
    post("2026-09-20", "YouTube", 3000),
    post("2026-10-01", "YouTube", 99999), // next month: not in the report
    post("2026-08-15", "TikTok", 2000),
    episode("2026-09-03", 0.4, 0.2, "ฮั้ว สว."),
    episode("2026-09-10", 0.3, 0.3, "น้ำท่วม"),
    episode("2026-08-20", 0.5, 0.25, "ส.ค."),
  ];
  const r = buildMonthlyReport(rows, "2026-09", [], meta);
  assert.equal(r.online.views, 4000);
  assert.equal(r.online.posts, 2);
  assert.equal(r.online.er, 100 / 4000);
  assert.equal(r.onlinePrev.views, 2000);
  assert.deepEqual(r.platforms.map((p) => [p.platform, p.views]), [["YouTube", 3000], ["TikTok", 1000]]);
  assert.equal(r.platforms[1].growth, -0.5);
  const one31 = r.tvChannels.find((c) => c.channel === "One31");
  const gmm = r.tvChannels.find((c) => c.channel === "GMM25");
  assert.equal(one31.episodes, 2);
  assert.ok(Math.abs(one31.avg - 0.35) < 1e-9);
  assert.equal(one31.prevAvg, 0.5);
  assert.deepEqual(one31.top.map((e) => e.date), ["2026-09-03", "2026-09-10"]);
  assert.deepEqual(gmm.top.map((e) => e.date), ["2026-09-10", "2026-09-03"]);
  assert.equal(Math.round(one31.audience), 490000);
  assert.equal(r.dataAt, "2026-10-08");
  // Frozen as plain data: what Firestore stores is what comes back.
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

test("competitors use the dashboard's own ranking, ratings outside 0–30 left out", () => {
  const rows = [episode("2026-09-03", 0.4, 0.2, "a"), episode("2026-09-04", 0.3, 0.2, "b")];
  const sources = [
    {
      channel: "One31",
      program: "ถกไม่เถียง",
      rows: [
        { date: "2026-09-03", competitorChannel: "ช่อง 7", program: "ข่าว", slot: "", rating: 113.7 },
        { date: "2026-09-04", competitorChannel: "ช่อง 7", program: "ข่าว", slot: "", rating: 0.2 },
        { date: "2026-09-03", competitorChannel: "", program: "โหนกระแส", slot: "", rating: 1.5 },
      ],
    },
  ];
  const r = buildMonthlyReport(rows, "2026-09", sources, meta);
  const channel = r.competitors.find((c) => c.mode === "channel");
  const slot = r.competitors.find((c) => c.mode === "slot");
  assert.deepEqual(channel.ranking.map((x) => [x.key, x.days]), [["ถกไม่เถียง", 2], ["ช่อง 7", 1]]);
  assert.equal(channel.ranking[1].winShare, 1);
  assert.equal(slot.ranking[0].key, "โหนกระแส");
});

test("recommendations carry their numbers and never name unknown programs", () => {
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push(post("2026-09-05", "YouTube", 5000 + i, { program: "ไม่ระบุรายการ" }));
  for (let i = 0; i < 25; i++) rows.push(post("2026-09-06", "Facebook", 500 + i, { program: "ไม่ระบุรายการ" }));
  for (let i = 0; i < 2; i++) rows.push(post("2026-08-06", "Facebook", 100, { program: "ไม่ระบุรายการ" }));
  const r = buildMonthlyReport(rows, "2026-09", [], meta);
  const first = r.recommendations[0];
  assert.equal(first.title, "เพิ่มน้ำหนักให้ YouTube");
  assert.match(first.because, /5\.0K/);
  assert.ok(!r.recommendations.some((x) => x.title.includes("ไม่ระบุ")));
  assert.ok(r.recommendations.some((x) => x.title === "ใส่ Hashtag ให้ครบ"));
});

const ytVideo = (id, o = {}) => ({ id, views: 1000, engagedViews: 800, avgViewSec: 60, avgViewPct: 90, subs: 5, shares: 1, likes: 1, comments: 1, revenue: 99, adRevenue: 99, grossRevenue: 99, cpm: 9, playbackCpm: 9, monetized: 1, ...o });

test("เชิงลึก: YouTube quality, traffic, engagement, weekdays and SEO come from the month's own clips; no revenue is kept", () => {
  const rows = [
    post("2026-09-04", "YouTube", 3000, { vdoType: "YouTube Shorts", url: "https://youtu.be/AAAAAAAAAAA", topic: "ข่าวหนึ่ง ".repeat(12), hashtags: "" }),
    post("2026-09-11", "YouTube", 1000, { vdoType: "YouTube Full Episode", url: "https://youtu.be/BBBBBBBBBBB", topic: "สั้น", hashtags: "#a" }),
    post("2026-09-12", "Instagram", 500, { shares: 50, comments: 5, skipRate: 60, avgWatchSec: 20 }),
    post("2026-08-12", "YouTube", 700, { vdoType: "YouTube Full Episode", url: "https://youtu.be/CCCCCCCCCCC" }),
  ];
  const yt = {
    updatedAt: "2026-10-09T01:00:00Z",
    videos: [
      ytVideo("AAAAAAAAAAA", { views: 3000, avgViewSec: 40, avgViewPct: 120, subs: 30, traffic: { SHORTS: 900, YT_SEARCH: 100 } }),
      ytVideo("BBBBBBBBBBB", { views: 1000, avgViewSec: 600, avgViewPct: 30, subs: 10, traffic: { SUBSCRIBER: 1000 } }),
      ytVideo("CCCCCCCCCCC", { views: 700, avgViewPct: 10, subs: 99 }), // August: not in September's numbers
    ],
    windows: { d28: { start: "2026-09-11", end: "2026-10-08", traffic: [{ source: "YT_SEARCH", views: 50 }, { source: "SUBSCRIBER", views: 950 }], searchTerms: [{ term: "ถกไม่เถียง ล่าสุด", views: 60 }, { term: "มวยวันลุมพินี", views: 40 }], contentType: [] },
      d90: { start: "2026-07-11", end: "2026-10-08", traffic: [], searchTerms: [], contentType: [] } },
    retention: [],
    search: {},
  };
  const gains = new Map([["2026-09-02", null], ["2026-09-03", [["k1", 100, 0, 0, 0, 0], ["k2", 50, 0, 0, 0, 0]]], ["2026-10-01", [["k1", 9999, 0, 0, 0, 0]]]]);
  const r = buildMonthlyReport(rows, "2026-09", [], meta, { yt, gains });
  const d = r.deep;
  assert.equal(d.youtube.matched, 2);
  assert.equal(d.youtube.posts, 2);
  assert.equal(d.youtube.shorts.videos, 1);
  assert.equal(d.youtube.shorts.avgViewPct, 120);
  assert.equal(d.youtube.long.avgViewSec, 600);
  assert.equal(d.youtube.newSubs, 40); // the August video's 99 are not counted
  assert.deepEqual(d.youtube.traffic.map((t) => t.source), ["SUBSCRIBER", "SHORTS", "YT_SEARCH"]);
  assert.equal(d.youtube.trafficVideos, 2);
  assert.equal(d.engagement.find((e) => e.platform === "Instagram").skipRate, 60);
  assert.equal(d.engagement.find((e) => e.platform === "Instagram").sharesPer1k, 100);
  // 4 and 11 Sept 2026 are Fridays (4 Fridays that month): 3000 + 1000 views.
  const friday = d.weekdays.find((w) => w.day === "ศ.");
  assert.equal(friday.posts, 2);
  assert.equal(friday.avgPerDay, (3000 + 1000) / 4);
  assert.deepEqual(d.growth, { days: 1, of: 30, totalViews: 150, perDay: 150, peaks: [{ day: "2026-09-03", views: 150 }] });
  assert.equal(d.seo.searchShare, 0.05);
  assert.equal(d.seo.brandShare, 0.6);
  assert.deepEqual(d.seo.gaps.map((g) => g.term), ["มวยวันลุมพินี"]);
  assert.equal(d.seo.titleOver70, 1);
  assert.equal(d.seo.noHashtag, 1);
  assert.doesNotMatch(JSON.stringify(d), /revenue|cpm|rpm/i);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

test("เชิงลึก without YouTube Analytics or daily gains leaves those parts out, nothing else breaks", () => {
  const r = buildMonthlyReport([post("2026-09-04", "TikTok", 1000)], "2026-09", [], meta);
  assert.equal(r.deep.youtube, null);
  assert.equal(r.deep.seo, null);
  assert.equal(r.deep.growth, null);
  assert.equal(r.deep.weekdays.length, 7);
});

test("short-clip features: groups under 20 clips are left out, index is against the platform's median", () => {
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push(post("2026-09-05", "TikTok", 900 + i, { topic: `คลิปธรรมดา ${i} ข้อความยาวพอ`, videoLengthSec: 20 }));
  for (let i = 0; i < 25; i++) rows.push(post("2026-09-06", "TikTok", 3000 + i, { topic: `“คำพูด” ${i} ข้อความยาวพอสมควร`, videoLengthSec: 45 }));
  for (let i = 0; i < 5; i++) rows.push(post("2026-09-07", "TikTok", 50, { topic: `หายาก ${i}`, videoLengthSec: 200 }));
  const r = buildMonthlyReport(rows, "2026-09", [], meta);
  const length = r.deep.shorts.features.find((f) => f.name === "ความยาวคลิป");
  assert.deepEqual(length.groups.map((g) => g.value), ["30–59 วิ", "ไม่ถึง 30 วิ"]);
  assert.ok(length.groups[0].index > 1 && length.groups[1].index < 1);
  assert.equal(r.deep.shorts.posts, 55);
});
