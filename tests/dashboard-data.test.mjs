import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  appType: "custom",
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(() => vite.close());
const { parseCsv } = await vite.ssrLoadModule("/lib/dashboard/csv.ts");
const { normalize } = await vite.ssrLoadModule("/lib/dashboard/normalize.ts");
const { sumBy, topicSimilarity } = await vite.ssrLoadModule(
  "/lib/dashboard/analytics.ts",
);
const { getDatePresetRange } = await vite.ssrLoadModule(
  "/lib/dashboard/dates.ts",
);
test("CSV preserves quoted commas, escaped quotes and multiline topics", () => {
  const rows = parseCsv(
    'Date,Topic,Views\r\n2026-09-01,"ข่าว, ตอนที่ ""1""\nต่อ",1200\r\n',
  );
  assert.deepEqual(rows, [
    { Date: "2026-09-01", Topic: 'ข่าว, ตอนที่ "1"\nต่อ', Views: "1200" },
  ]);
});
test("normalization keeps TV rating and audience as separate source metrics", () => {
  const row = normalize({
    Date: "01/09/2026",
    Platform: "TV",
    Views: "1,200",
    TV_Rating_Total: "0.45",
    TV_Audience_Total: "9,000",
    Notes: "GMM Rating: 0.2 GMM Audience: 3,000",
  });
  assert.equal(row.date, "2026-09-01");
  assert.equal(row.ratingTotal, 0.45);
  assert.equal(row.audienceTotal, 9000);
  assert.equal(row.gmmRating, 0.2);
  assert.equal(row.gmmAudience, 3000);
});
test("digital normalization preserves explicit percentages and inferred engagement", () => {
  const row = normalize({
    Date: "2026-09-01",
    Platform: "YouTube",
    Views: "1,000",
    Likes: "20",
    Comments: "5",
    Shares: "5",
    Engagement_Rate: "3%",
    VDO_Type: "short",
  });
  assert.equal(row.views, 1000);
  assert.equal(row.engagement, 30);
  assert.equal(row.engagementRate, 0.03);
  assert.equal(row.vdoType, "YouTube Shorts");
});
test("grouping and topic matching retain their existing behavior", () => {
  assert.deepEqual(
    sumBy(
      [
        { p: "YT", v: 2 },
        { p: "FB", v: 3 },
        { p: "YT", v: 4 },
      ],
      (r) => r.p,
      (r) => r.v,
    ),
    [
      { name: "YT", total: 6 },
      { name: "FB", total: 3 },
    ],
  );
  assert.equal(topicSimilarity("ข่าวไทย กัมพูชา #ข่าว", "ข่าวไทย กัมพูชา"), 1);
  assert.equal(topicSimilarity("", "ข่าว"), 0);
});
test("quarter presets use the selected data year", () => {
  assert.deepEqual(getDatePresetRange("QUARTER_4", 2025), [
    "2025-10-01",
    "2025-12-31",
  ]);
  assert.deepEqual(getDatePresetRange("QUARTER_1", 2024), [
    "2024-01-01",
    "2024-03-31",
  ]);
});
