import assert from "node:assert/strict";
import test from "node:test";
import { bestSlots, change, digitalKpis, formatMix, inRange, postingHeatmap, tvKpis } from "../lib/dashboard/platformReport.ts";

// Only the fields the report reads.
const row = (o) => ({ date: o.Date, platform: o.Platform || "TikTok", vdoType: o.VDO_Type || "TikTok", publishTime: o.Publish_Time || "", views: o.Views || 0, likes: o.Likes || 0, comments: o.Comments || 0, shares: o.Shares || 0, ratingTotal: o.Rating_Total || 0, audienceTotal: o.Audience_Total || 0, gmmRating: o.GMM_Rating || 0 });

test("headline numbers: sum, median per post, ER and per-1,000 rates; change", () => {
  const rows = [row({ Date: "2026-09-01", Views: 1000, Likes: 50, Comments: 10, Shares: 20 }), row({ Date: "2026-09-02", Views: 3000, Likes: 100, Comments: 30, Shares: 40 }), row({ Date: "2026-09-03", Views: 2000 })];
  const k = digitalKpis(rows);
  assert.equal(k.views, 6000);
  assert.equal(k.posts, 3);
  assert.equal(k.medianViews, 2000);
  assert.equal(k.er, 250 / 6000);
  assert.equal(k.sharesPer1k, 10);
  assert.equal(inRange(rows, "2026-09-02", "2026-09-03").length, 2);
  assert.equal(change(150, 100), 0.5);
  assert.equal(change(5, 0), null);
  assert.equal(change(null, 3), null);
});

test("VDO type mix: share of posts against share of views", () => {
  const rows = [row({ Date: "2026-09-01", VDO_Type: "Shorts", Views: 100 }), row({ Date: "2026-09-01", VDO_Type: "Shorts", Views: 100 }), row({ Date: "2026-09-01", VDO_Type: "Video", Views: 800 })];
  const [first, second] = formatMix(rows);
  assert.equal(first.vdoType, "Video");
  assert.equal(first.viewShare, 0.8);
  assert.equal(second.postShare, 2 / 3);
  assert.equal(second.medianViews, 100);
});

test("posting heatmap: Monday first, median only with 3+ posts, posts without a time counted apart", () => {
  // 2026-09-07 is a Monday.
  const mon = (t, v) => row({ Date: "2026-09-07", Publish_Time: t, Views: v });
  const rows = [mon("18:05", 100), mon("18:40", 300), mon("18:59", 200), mon("09:00", 999), row({ Date: "2026-09-08", Views: 5 }), mon("00:00", 7)];
  const h = postingHeatmap(rows);
  assert.equal(h.cells[0][18].posts, 3);
  assert.equal(h.cells[0][18].medianViews, 200);
  assert.equal(h.cells[0][9].medianViews, null);
  assert.equal(h.noTime, 2); // no time, and the "00:00" placeholder
  assert.deepEqual(bestSlots(h), [{ day: 0, hour: 18, medianViews: 200, posts: 3 }]);
});

test("TV: episodes, average ratings of rated episodes, audience", () => {
  const tv = [row({ Date: "2026-09-01", Platform: "TV", Rating_Total: 1.2, Audience_Total: 500, GMM_Rating: 0.8 }), row({ Date: "2026-09-02", Platform: "TV", Rating_Total: 0.8, Audience_Total: 300 })];
  const t = tvKpis(tv);
  assert.equal(t.episodes, 2);
  assert.equal(t.rating, 1);
  assert.equal(t.audience, 800);
  assert.equal(t.gmmRating, 0.8);
});
