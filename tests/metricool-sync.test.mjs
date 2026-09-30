import assert from "node:assert/strict";
import test from "node:test";
import {
  bangkokParts,
  buildSnapshot,
  chunkSnapshot,
  dedupeDigitalRows,
  detectProgram,
  mapPost,
  mergeIntoMaster,
  postId,
  postTimeUtc,
  rowKey,
  zonedToUtc,
} from "../lib/integrations/metricoolSync.ts";

const TERO = { blogId: 6487104, label: "TERO Digital", mode: "multi", enabled: true };
const THOK = { blogId: 6499952, label: "ถกไม่เถียง", mode: "single", program: "ถกไม่เถียง", enabled: true };

test("Metricool dates (Madrid, with DST) land on the right Bangkok day", () => {
  // Summer: Madrid UTC+2 → 20:30 Madrid = 01:30 next day in Bangkok.
  const summer = postTimeUtc({ dateTime: "2026-09-05T20:30:00", timezone: "Europe/Madrid" });
  assert.deepEqual(bangkokParts(summer), { iso: "2026-09-06", date: "06/09/2026", time: "01:30" });
  // Winter: Madrid UTC+1.
  assert.equal(new Date(zonedToUtc("2026-01-10T10:00:00", "Europe/Madrid")).toISOString(), "2026-01-10T09:00:00.000Z");
  // TikTok style offset and Facebook epoch milliseconds.
  assert.equal(bangkokParts(postTimeUtc("2026-09-26T11:58:58+0200")).time, "16:58");
  assert.equal(bangkokParts(postTimeUtc(1790670955000)).iso, "2026-09-29");
});

test("post ids come from each platform's URL shapes", () => {
  assert.equal(postId("YouTube", "https://www.youtube.com/watch?v=zu18DUg143A"), "zu18DUg143A");
  assert.equal(postId("YouTube", "https://youtube.com/shorts/z84OlcxI0-M"), "z84OlcxI0-M");
  assert.equal(postId("TikTok", "https://www.tiktok.com/@terodigital/video/7671245253935893780?utm=x"), "7671245253935893780");
  assert.equal(postId("Instagram", "https://www.instagram.com/reel/DAbc12-xy/"), "DAbc12-xy");
  assert.equal(postId("Facebook", "https://www.facebook.com/reel/1049539704083857/"), "1049539704083857");
  assert.equal(postId("Facebook", "https://www.facebook.com/330339053719456/posts/1069294735733466"), "1069294735733466");
  assert.equal(rowKey({ Platform: "YouTube", URL: "https://youtu.be/zu18DUg143A" }), "YouTube|zu18DUg143A");
});

test("program detection prefers the more specific show name", () => {
  assert.equal(detectProgram("🔴 [LIVE] เงินทองของจริง | วัย 25-35"), "เงินทองของจริง");
  assert.equal(detectProgram("ฮั้ว สว. #ถกไม่เถียง"), "ถกไม่เถียง");
  assert.equal(detectProgram("กับ ทิน โชคกมลกิจ"), "ถกไม่เถียง");
  assert.equal(detectProgram("โปรโมชันลดราคา"), "ไม่ระบุ");
});

test("each network maps to a master row with the team's labels", () => {
  const yt = mapPost("youtube", {
    videoId: "zu18DUg143A", title: "🔴 [LIVE] ถกไม่เถียง 18 ก.ย.", description: "",
    publishedAt: { dateTime: "2026-09-18T10:40:00", timezone: "Europe/Madrid" },
    views: 1000, likes: 50, comments: 10, shares: 5, durationSeconds: 2700, videoType: "VIDEO",
  }, TERO);
  assert.equal(yt.Platform, "YouTube");
  assert.equal(yt.VDO_Type, "LIVE");
  assert.equal(yt.Program, "ถกไม่เถียง");
  assert.equal(yt.Date, "2026-09-18");
  assert.equal(yt.Publish_Time, "15:40");
  assert.equal(yt.Engagement, "65");
  assert.equal(yt.Engagement_Rate, "6.50%");
  assert.equal(yt._review, false);

  const reel = mapPost("fbreels", {
    reelId: "1049539704083857", reelUrl: "https://www.facebook.com/reel/1049539704083857/", description: "ข่าวเช้า",
    created: { dateTime: "2026-06-30T13:01:41", timezone: "Europe/Madrid" },
    blueReelsPlayCount: 3096, postVideoReactions: 44, postVideoSocialActions: 10, length: 237.3,
  }, TERO);
  assert.equal(reel.VDO_Type, "Facebook Reels");
  assert.equal(reel.Views, "3096");
  assert.equal(reel.Likes, "44");
  assert.equal(reel.Comments, "10");
  assert.equal(reel._review, true); // multi-program brand, no show name in the text

  const fbPost = mapPost("facebook", {
    postId: "330339053719456_1069294735733466", link: "https://www.facebook.com/330339053719456/posts/1069294735733466",
    text: "#ถกไม่เถียง", type: "video", timestamp: 1790670955000, videoViews: 900, impressions: 4852, reactions: 225, comments: 29, shares: 6,
  }, TERO);
  assert.equal(fbPost.VDO_Type, "Facebook Post"); // videos in the posts feed are still "Facebook Post"
  // Team data: Facebook Views = impressions, also for video posts (not video views).
  assert.equal(fbPost.Views, "4852");
  const noImpressions = mapPost("facebook", {
    postId: "330339053719456_1069294735733467", link: "https://www.facebook.com/330339053719456/posts/1069294735733467",
    text: "#ถกไม่เถียง", type: "video", timestamp: 1790670955000, videoViews: 900, reactions: 1, comments: 0, shares: 0,
  }, TERO);
  assert.equal(noImpressions.Views, "900");

  const tt = mapPost("tiktok", {
    videoId: "7689781312269356294", shareUrl: "https://www.tiktok.com/@thok/video/7689781312269356294",
    videoDescription: "คลิปสั้น", createTime: "2026-09-26T11:58:58+0200", viewCount: 1245, likeCount: 5, commentCount: 0, shareCount: 1,
  }, THOK);
  assert.equal(tt.Program, "ถกไม่เถียง"); // single-program brand
  assert.equal(tt.Channel, "ถกไม่เถียง");

  assert.equal(mapPost("youtube", { title: "no id" }, TERO), null);
});

test("merge updates only numbers and never the team's columns", () => {
  const master = [
    {
      Date: "18/09/2026", Platform: "YouTube", URL: "https://www.youtube.com/watch?v=zu18DUg143A",
      Program: "ถกไม่เถียง", Topic: "หัวข้อที่ทีมแก้", Topic_Type: "ข่าวการเมือง", VDO_Type: "YouTube Highlight",
      Episode_ID: "TKT-1", Best_of_Month: "Yes", Revenue: "120", Notes: "ทีมเขียน", Views: "500", Likes: "10", Comments: "1", Shares: "0",
    },
    { Date: "01/09/2026", Platform: "TV", Program: "ถกไม่เถียง", TV_Rating_Total: "0.33" },
  ];
  const incoming = [
    mapPost("youtube", { videoId: "zu18DUg143A", title: "ชื่อจาก API", publishedAt: { dateTime: "2026-09-18T10:40:00", timezone: "Europe/Madrid" }, views: 1553329, likes: 20, comments: 3, shares: 1, videoType: "VIDEO" }, TERO),
    mapPost("youtube", { videoId: "NEWvideo001", title: "#ถกไม่เถียง ใหม่", publishedAt: { dateTime: "2026-09-19T10:00:00", timezone: "Europe/Madrid" }, views: 10, videoType: "SHORT" }, TERO),
    mapPost("youtube", { videoId: "NEWvideo001", title: "duplicate", publishedAt: { dateTime: "2026-09-19T10:00:00", timezone: "Europe/Madrid" }, views: 99, videoType: "SHORT" }, TERO),
  ];
  const r = mergeIntoMaster(master, incoming);
  const yt = r.merged[0];
  for (const col of ["Program", "Topic", "Topic_Type", "VDO_Type", "Episode_ID", "Best_of_Month", "Revenue", "Notes"]) {
    assert.equal(yt[col], master[0][col], `${col} must not change`);
  }
  assert.equal(yt.Views, "1553329");
  assert.equal(r.updated.length, 1);
  assert.equal(r.inserted.length, 1); // the duplicate id is ignored
  assert.equal(r.merged.length, 3);
  assert.equal(r.merged[1].TV_Rating_Total, "0.33"); // TV rows untouched
  assert.ok(!("_review" in r.merged[2]), "internal flags are not stored");

  const snap = buildSnapshot(r);
  assert.deepEqual(snap.map((s) => s.k).sort(), ["YouTube|NEWvideo001", "YouTube|zu18DUg143A"]);
  assert.equal(snap.find((s) => s.k === "YouTube|zu18DUg143A").v, 1553329);
  assert.equal(chunkSnapshot(Array.from({ length: 12001 }, (_, i) => ({ k: `x|${i}`, v: 0, l: 0, c: 0, s: 0 }))).length, 3);
});

test("duplicate digital posts collapse to the newest row; TV is untouched", () => {
  const rows = [
    { Platform: "YouTube", URL: "https://www.youtube.com/watch?v=_KoUbHDF2BE", Views: "9175", Program: "ไม่ระบุ", Topic_Type: "ข่าวการเมือง" },
    { Platform: "TV", URL: "-", Date: "2026-09-01", Views: "0" },
    { Platform: "YouTube", URL: "https://youtu.be/_KoUbHDF2BE", Views: "16969", Program: "ไม่ระบุ", Topic_Type: "" },
    { Platform: "TV", URL: "-", Date: "2026-09-02", Views: "0" },
    { Platform: "YouTube", URL: "https://www.youtube.com/watch?v=other000001", Views: "5" },
  ];
  const r = dedupeDigitalRows(rows);
  assert.equal(r.groups, 1);
  assert.equal(r.removed.length, 1);
  assert.equal(r.removed[0].row.Views, "9175");
  assert.equal(r.rows.length, 4); // both TV rows kept
  const kept = r.rows.find((x) => String(x.URL).includes("_KoUbHDF2BE"));
  assert.equal(kept.Views, "16969"); // the newest (highest lifetime) count
  assert.equal(kept.Topic_Type, "ข่าวการเมือง"); // borrowed from the copy
});
