import assert from "node:assert/strict";
import test from "node:test";
import { applyVideoStats } from "../lib/integrations/youtubeAnalytics.ts";

const row = (id, extra = {}) => ({ Platform: "YouTube", Content_ID: id, Views: "1,000", Likes: "40", Comments: "10", Shares: "0", Avg_Watch_Sec: "", Engagement: "50", Engagement_Rate: "5.00%", ...extra });

test("watch time and shares come from Analytics; engagement follows; views and other platforms stay", () => {
  const rows = [row("a"), row("b"), { ...row("a"), Platform: "TikTok" }];
  const stats = new Map([["a", { views: 900, averageViewDuration: 57.4, averageViewPercentage: 119.7, subscribersGained: 3, shares: 25 }]]);
  assert.equal(applyVideoStats(rows, stats), 1);
  assert.equal(rows[0].Avg_Watch_Sec, "57");
  assert.equal(rows[0].Shares, "25");
  assert.equal(rows[0].Engagement, "75");
  assert.equal(rows[0].Engagement_Rate, "7.50%");
  assert.equal(rows[0].Views, "1,000"); // the Data API's live count stays
  assert.equal(rows[1].Avg_Watch_Sec, ""); // no Analytics row: untouched
  assert.equal(rows[2].Shares, "0"); // not YouTube
});

test("Analytics errors become an action for the admin", async () => {
  const { analyticsProblem } = await import("../lib/integrations/youtubeAnalytics.ts");
  assert.match(analyticsProblem("Google token: invalid_grant Token has been expired or revoked."), /ต้องล็อกอินใหม่/);
  assert.match(analyticsProblem("YouTube Analytics: Forbidden"), /ไม่มีสิทธิ์ใน CMS/);
  assert.match(analyticsProblem("YT_OAUTH_CLIENT missing"), /GitHub Secrets/);
});

test("Google internal errors are retried, then the batch is split; real errors stop at once", async () => {
  const { videoStats } = await import("../lib/integrations/youtubeAnalytics.ts");
  const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
  const reply = (status, body) => ({ ok: status === 200, status, json: async () => body });
  const ok = (batch) => reply(200, { columnHeaders: ["video", "views", "averageViewDuration", "averageViewPercentage", "subscribersGained", "shares"].map((name) => ({ name })), rows: batch.map((v) => [v, 10, 30, 50, 1, 2]) });
  const batchOf = (url) => new URL(url).searchParams.get("filters").replace("video==", "").split(",");
  let calls = 0;
  // A 120-video request always fails with an internal error; smaller ones work.
  const flaky = async (url) => { calls++; const b = batchOf(url); return b.length > 50 ? reply(500, { error: { message: "An internal error has occurred." } }) : ok(b); };
  const stats = await videoStats("t", "owner", ids, "2026-10-05", async () => {}, flaky);
  assert.equal(stats.size, 120);
  assert.equal(stats.get("v7").averageViewDuration, 30);
  assert.equal(calls, 4 + 4); // 4 tries of the whole batch, then 4 quarters
  const denied = async () => reply(403, { error: { message: "Forbidden" } });
  await assert.rejects(videoStats("t", "owner", ids, "2026-10-05", async () => {}, denied), /Forbidden/);
});
