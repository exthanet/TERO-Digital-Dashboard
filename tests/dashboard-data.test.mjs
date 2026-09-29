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
const { normalize, normalizeRowsWithDeduplication, normalizeTopic } =
  await vite.ssrLoadModule("/lib/dashboard/normalize.ts");
const { sumBy, topicSimilarity } = await vite.ssrLoadModule(
  "/lib/dashboard/analytics.ts",
);
const { getDatePresetRange } = await vite.ssrLoadModule(
  "/lib/dashboard/dates.ts",
);
const { periodFor, shiftPeriod, rankClips, rankEpisodes } = await vite.ssrLoadModule(
  "/lib/dashboard/ranking.ts",
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
test("TV rows split per channel merge without mixing One31 and GMM25", () => {
  const tv = (channel, rating, audience, notes = "") => ({
    Date: "2026-09-14",
    Program: "ถกไม่เถียง",
    Platform: "TV",
    Channel: channel,
    Topic: "ประเด็นทดสอบ",
    TV_Rating_Total: String(rating),
    TV_Audience_Total: String(audience),
    Notes: notes,
  });
  // GMM25 first: it must not be taken as the One31 figures.
  const [row] = normalizeRowsWithDeduplication([
    tv("GMM25", 0.127, 88900),
    tv("One31", 0.264, 124333),
    tv("ONE31", 0.264, 124333, "GMM Rating: 0.127; GMM Audience: 88900"),
  ]);
  assert.equal(row.ratingTotal, 0.264);
  assert.equal(row.audienceTotal, 124333);
  assert.equal(row.gmmRating, 0.127);
  assert.equal(row.gmmAudience, 88900);
});
test("blank-like topic types collapse into one category", () => {
  assert.equal(normalizeTopic(""), "ไม่ระบุประเภท");
  assert.equal(normalizeTopic("ไม่ระบุ"), "ไม่ระบุประเภท");
  assert.equal(normalizeTopic("#REF!"), "ไม่ระบุประเภท");
  assert.equal(normalizeTopic("การเงิน"), "การเงิน / ธุรกิจ");
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

const clip = (date, platform, vdoType, views, topic) => ({
  date, platform, vdoType, views, topic, url: "", contentId: topic,
  ratingTotal: 0, gmmRating: 0, audienceTotal: 0, gmmAudience: 0,
});
test("ranking periods: day, Monday-Sunday week, and shifting", () => {
  assert.deepEqual(periodFor("2026-09-24", "day"), { start: "2026-09-24", end: "2026-09-24" });
  // 2026-09-24 is a Thursday.
  assert.deepEqual(periodFor("2026-09-24", "week"), { start: "2026-09-21", end: "2026-09-27" });
  assert.deepEqual(periodFor("2026-09-21", "week"), { start: "2026-09-21", end: "2026-09-27" });
  assert.deepEqual(periodFor("2026-09-27", "week"), { start: "2026-09-21", end: "2026-09-27" });
  assert.equal(shiftPeriod("2026-09-24", "week", -1), "2026-09-17");
  assert.equal(shiftPeriod("2026-09-01", "day", -1), "2026-08-31");
});
test("clips are ranked against the median of their own platform and format", () => {
  const history = [];
  for (let i = 1; i <= 5; i++) {
    history.push(clip(`2026-09-0${i}`, "YouTube", "YouTube Full Episode", 1_000_000, `yt-${i}`));
    history.push(clip(`2026-09-0${i}`, "Facebook", "Facebook Post", 1_000, `fb-${i}`));
  }
  const week = [
    clip("2026-09-21", "YouTube", "YouTube Full Episode", 500_000, "yt-half"), // 0.5x
    clip("2026-09-22", "Facebook", "Facebook Post", 5_000, "fb-5x"),           // 5x
    clip("2026-09-23", "Facebook", "Facebook Post", 900, "fb-0.9x"),           // 0.9x
    clip("2026-09-27", "Facebook", "Facebook Post", 10, "fb-fresh"),           // fresh
  ];
  const r = rankClips([...history, ...week], periodFor("2026-09-24", "week"), "2026-09-27", 2);
  assert.equal(r.total, 4);
  // The 5,000-view Facebook post beats the 500,000-view YouTube video on its own scale.
  assert.equal(r.best[0].row.topic, "fb-5x");
  assert.equal(r.best[0].index, 5);
  // Worst skips the clip published within 2 days of the latest data and anything already in best.
  assert.deepEqual(r.worst.map((x) => x.row.topic), ["yt-half"]);
});
test("TV episodes sort by One31 rating and compare with the previous 4 weeks", () => {
  const ep = (date, rating) => ({ ...clip(date, "TV", "TV Episode", 0, date), ratingTotal: rating, program: "ถกไม่เถียง" });
  const rows = [ep("2026-09-01", 0.3), ep("2026-09-02", 0.3), ep("2026-09-22", 0.33), ep("2026-09-23", 0.27)];
  const r = rankEpisodes(rows, periodFor("2026-09-24", "week"));
  assert.deepEqual(r.map((x) => x.row.date), ["2026-09-22", "2026-09-23"]);
  assert.ok(Math.abs(r[0].vsAverage - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1].vsAverage + 0.1) < 1e-9);
});
