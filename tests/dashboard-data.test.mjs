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
const { normalize, normalizeRowsWithDeduplication, normalizeTopic, excelDate, isPlainDay, countNonPlainDates, sourceDay } =
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
test("quarter presets carry their year", () => {
  assert.deepEqual(getDatePresetRange("QUARTER_2025_4"), [
    "2025-10-01",
    "2025-12-31",
  ]);
  assert.deepEqual(getDatePresetRange("QUARTER_2024_1"), [
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
  // Clips with almost no views (removed, private, not counted) are never "worst".
  const withZero = rankClips([...history, ...week, clip("2026-09-22", "YouTube", "YouTube Full Episode", 0, "yt-zero"), clip("2026-09-22", "Facebook", "Facebook Post", 49, "fb-49")], periodFor("2026-09-24", "week"), "2026-09-27", 2);
  assert.ok(!withZero.worst.some((x) => ["yt-zero", "fb-49"].includes(x.row.topic)));
  assert.deepEqual(withZero.worst.map((x) => x.row.topic), ["yt-half"]);
  // By raw views: most views first; worst is fewest views first, with the same exclusions.
  const byViews = rankClips([...history, ...week, clip("2026-09-22", "Facebook", "Facebook Post", 49, "fb-49")], periodFor("2026-09-24", "week"), "2026-09-27", 2, "views");
  assert.deepEqual(byViews.best.map((x) => x.row.topic), ["yt-half", "fb-5x"]);
  assert.deepEqual(byViews.worst.map((x) => x.row.topic), ["fb-0.9x"]);
});
test("TV episodes sort by One31 rating and compare with the previous 4 weeks", () => {
  const ep = (date, rating) => ({ ...clip(date, "TV", "TV Episode", 0, date), ratingTotal: rating, program: "ถกไม่เถียง" });
  const rows = [ep("2026-09-01", 0.3), ep("2026-09-02", 0.3), ep("2026-09-22", 0.33), ep("2026-09-23", 0.27)];
  const r = rankEpisodes(rows, periodFor("2026-09-24", "week"));
  assert.deepEqual(r.map((x) => x.row.date), ["2026-09-22", "2026-09-23"]);
  assert.ok(Math.abs(r[0].vsAverage - 0.1) < 1e-9);
  assert.ok(Math.abs(r[1].vsAverage + 0.1) < 1e-9);
});

test("dates are read exactly as stored, never shifted", () => {
  // masterData stores plain days that match the source files.
  assert.equal(excelDate("2026-09-27"), "2026-09-27");
  assert.equal(excelDate("27/09/2026"), "2026-09-27");
  assert.equal(excelDate("27/09/2569"), "2026-09-27");
  assert.equal(excelDate(46292), "2026-09-27"); // Excel serial
  // Legacy instants are read literally (UTC date), not compensated.
  assert.equal(excelDate("2026-09-26T16:59:56Z"), "2026-09-26");
  assert.equal(excelDate(""), "");
  assert.equal(excelDate("not a date"), "");
});

test("non-plain stored dates are counted so the dashboard can warn", () => {
  assert.equal(isPlainDay("2026-09-27"), true);
  assert.equal(isPlainDay("2026-09-26T16:59:56Z"), false);
  assert.equal(countNonPlainDates([{ Date: "2026-09-27" }, { Date: "2026-09-26T16:59:56Z" }, { Date: 46292 }, { Topic: "no date" }]), 2);
});

test("imports store the day exactly as written in the file", () => {
  assert.equal(sourceDay(46292), "2026-09-27"); // Excel date cell (serial)
  assert.equal(sourceDay("27/09/2026"), "2026-09-27"); // CSV / Google Sheet text
  assert.equal(sourceDay("27/09/2569 00:00"), "2026-09-27");
  assert.equal(sourceDay("2026-09-27"), "2026-09-27");
  // Anything needing a timezone guess is refused instead of invented.
  assert.equal(sourceDay(new Date("2026-09-26T17:00:00Z")), "");
  assert.equal(sourceDay("2026-09-26T16:59:56Z"), "");
  assert.equal(sourceDay(1790670955000), "");
});

test("28 วันล่าสุด: 28 full days ending yesterday (Bangkok)", async () => {
  const { getDatePresetRange } = await import("../lib/dashboard/dates.ts");
  const [start, end] = getDatePresetRange("LAST_28_DAYS");
  const todayBkk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const day = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  assert.equal(end, day(todayBkk, -1));
  assert.equal(start, day(todayBkk, -28));
  assert.equal((Date.parse(end) - Date.parse(start)) / 86400000 + 1, 28);
});

test("date menu: ranges end yesterday; years, months, quarters from the data", async () => {
  const { getDatePresetRange, datePresetGroups } = await import("../lib/dashboard/dates.ts");
  const now = new Date("2026-10-01T03:00:00Z"); // 10:00 in Bangkok, 1 Oct 2026
  assert.deepEqual(getDatePresetRange("LAST_7_DAYS", undefined, now), ["2026-09-24", "2026-09-30"]);
  assert.deepEqual(getDatePresetRange("LAST_90_DAYS", undefined, now), ["2026-07-03", "2026-09-30"]);
  assert.deepEqual(getDatePresetRange("LAST_365_DAYS", undefined, now), ["2025-10-01", "2026-09-30"]);
  assert.deepEqual(getDatePresetRange("ALL", { first: "2025-08-06", last: "2026-10-01" }, now), ["2025-08-06", "2026-10-01"]);
  assert.deepEqual(getDatePresetRange("YEAR_2026", undefined, now), ["2026-01-01", "2026-09-30"]);
  assert.deepEqual(getDatePresetRange("YEAR_2025", undefined, now), ["2025-01-01", "2025-12-31"]);
  assert.deepEqual(getDatePresetRange("MONTH_2026-09", undefined, now), ["2026-09-01", "2026-09-30"]);
  assert.deepEqual(getDatePresetRange("QUARTER_2026_3", undefined, now), ["2026-07-01", "2026-09-30"]);
  const groups = datePresetGroups("2025-08-06", now);
  const values = (label) => groups.find((g) => g.label === label).options.map((o) => o.value);
  assert.deepEqual(values("รายปี"), ["YEAR_2026", "YEAR_2025"]);
  assert.deepEqual(values("รายเดือน"), ["MONTH_2026-09", "MONTH_2026-08", "MONTH_2026-07"]); // 1 Oct: no full day of Oct yet
  assert.deepEqual(values("รายไตรมาส"), ["QUARTER_2026_3", "QUARTER_2026_2", "QUARTER_2026_1"]);
  const mid = datePresetGroups("2025-08-06", new Date("2026-10-15T03:00:00Z"));
  assert.equal(mid.find((g) => g.label === "รายเดือน").options[0].label, "ต.ค. 2569 (ถึงเมื่อวาน)");
});

test("comparison: previous period, same period last year, custom, none", async () => {
  const { getCompareRange, shiftYear } = await import("../lib/dashboard/dates.ts");
  assert.deepEqual(getCompareRange("2026-09-03", "2026-09-30", "PREVIOUS"), { start: "2026-08-06", end: "2026-09-02" });
  assert.deepEqual(getCompareRange("2026-09-01", "2026-09-30", "YEAR_AGO"), { start: "2025-09-01", end: "2025-09-30" });
  assert.equal(shiftYear("2028-02-29", -1), "2027-02-28");
  assert.deepEqual(getCompareRange("2026-09-01", "2026-09-30", "CUSTOM", { start: "2026-06-01", end: "2026-06-30" }), { start: "2026-06-01", end: "2026-06-30" });
  assert.equal(getCompareRange("2026-09-01", "2026-09-30", "CUSTOM", { start: "2026-06-30", end: "2026-06-01" }), null);
  assert.equal(getCompareRange("2026-09-01", "2026-09-30", "NONE"), null);
});

test("report ranges longer than a month rank against the median inside the range", () => {
  // No history before the range (e.g. "ทั้งหมด"): the range itself is the baseline.
  const rows = [];
  for (let i = 1; i <= 9; i++) rows.push(clip(`2026-0${i}-10`, "YouTube", "YouTube Shorts", 1_000, `s-${i}`));
  rows.push(clip("2026-05-20", "YouTube", "YouTube Shorts", 9_000, "star"));
  rows.push(clip("2026-06-20", "YouTube", "YouTube Shorts", 100, "flop"));
  const long = rankClips(rows, { start: "2026-01-01", end: "2026-09-30" }, "2026-09-30", 1);
  assert.equal(long.baselineKind, "within");
  assert.equal(long.best[0].row.topic, "star");
  assert.equal(long.best[0].index, 9);
  assert.equal(long.worst[0].row.topic, "flop");
  // A 28-day range keeps the 30 days before as its baseline.
  const short = rankClips(rows, { start: "2026-09-03", end: "2026-09-30" }, "2026-09-30", 1);
  assert.equal(short.baselineKind, "prior30");
});
