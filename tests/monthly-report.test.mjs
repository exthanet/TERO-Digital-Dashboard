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
