import assert from "node:assert/strict";
import test from "node:test";
import { episodeNumbers, mergeTvEpisodes, parseTvSheet, thaiDay } from "../lib/integrations/tvSheet.ts";
import { validateTv } from "../lib/integrations/syncValidation.ts";

const ONE_HEADER = ["วันที่", "ประเภทเนื้อหา", "เวลาออกอากาศ\r\n(ไม่รวมโฆษณา)", "ประเด็น", "เรตติง ONE", "เรตติง GMM", "15+BKK", "15+URBAN", "15+BKK&URBAN", "15+RURAL", "Viewership (15+)", "เรทติงรายการ (นาที)", "ถกไม่เถียง ONE \r\n15.45 - 16.30 น.", "โหนกระแส\r\n12.35 - 13.30 น.", "เรทติงคู่แข่งช่อง 3", "เรตติง"];

test("Thai dates in the workbook become plain days", () => {
  assert.equal(thaiDay("จันทร์ 5 ม.ค. 2026"), "2026-01-05");
  assert.equal(thaiDay("พฤหัส 25 มิ.ย. 2569"), "2026-06-25");
  assert.equal(thaiDay("12 ก.ย. 69"), "2026-09-12");
  assert.equal(thaiDay("เฉลี่ยเดือน ม.ค 69"), "");
  assert.equal(thaiDay(""), "");
});

test("a tab is read by header names: episodes, pending, cancelled, competitors", () => {
  const aoa = [
    ONE_HEADER,
    ["จันทร์ 5 ม.ค. 2026", "ข่าวการเมือง", "42 นาที", "ม้ามืด", 0.308, 0.07, 0.475, 0.611, 0.555, 0.159, "622,252 Reach (4+)", 45, 0.308, 1.2, "ละครเย็น", 0.759],
    ["เฉลี่ยเดือน ม.ค 69", "", "", "", 0.3],
    ["อังคาร 6 ม.ค. 2026", "ข่าว", "41 นาที", "งดออกอากาศ", "งด", "", "งด", "งด", "งด", "งด", "", 45],
    ["พุธ 7 ม.ค. 2026", "ข่าว", "41 นาที", "ยังไม่มีเรตติ้ง", "", "", "", "", "", "", "", 45],
  ];
  const p = parseTvSheet(aoa, { channel: "One31", program: "ถกไม่เถียง" });
  assert.deepEqual(p.missingColumns, []);
  assert.equal(p.episodes.length, 1);
  assert.deepEqual(p.cancelled, ["2026-01-06"]);
  assert.deepEqual(p.pending, ["2026-01-07"]);
  assert.equal(p.skippedRows, 1);
  const e = p.episodes[0];
  assert.equal(e.rating, 0.308); // "เรตติง ONE", not the GMM column
  assert.equal(e.durationMin, 42);
  assert.equal(e.viewers, 622252);
  // own-program slot column is not a competitor
  assert.deepEqual(p.competitors.map((c) => `${c.competitorChannel}|${c.program}|${c.slot}|${c.rating}`), ["ช่อง 3|ละครเย็น||0.759", "|โหนกระแส|12.35 - 13.30 น.|1.2"]);
});

test("audience is rating × 700,000; One31 total uses Viewership when filled", () => {
  const base = { date: "2026-01-05", program: "ถกไม่เถียง", topic: "", topicType: "", durationMin: 42, rating: 0.168, bkk: 0.188, urban: 0.178, bkkUrban: 0.182, rural: 0.094, viewers: 0 };
  const gmm = episodeNumbers({ ...base, channel: "GMM25" });
  assert.equal(gmm.TV_Audience_Total, 117600);
  assert.equal(gmm["TV_Audience_15+BKK"], 131600);
  assert.equal(gmm["TV_Audience_15+RURAL"], 65800);
  assert.equal(episodeNumbers({ ...base, channel: "One31", viewers: 622252 }).TV_Audience_Total, 622252);
  assert.equal(episodeNumbers({ ...base, channel: "One31" }).TV_Audience_Total, 117600);
});

const tvRow = (over) => ({
  Date: "2026-01-05", Program: "ถกไม่เถียง", Platform: "TV", Channel: "One31", Topic: "ทีมกรอก", Topic_Type: "ข่าว", Notes: "",
  TV_Rating_Total: 0.3, "TV_Rating_15+BKK": 0.4, "TV_Rating_15+URBAN": 0.5, "TV_Rating_15+BKK&URBAN": 0.45, "TV_Rating_15+RURAL": 0.2,
  TV_Audience_Total: 210000, "TV_Audience_15+BKK": 280000, "TV_Audience_15+URBAN": 350000, "TV_Audience_15+BKK&URBAN": 315000, "TV_Audience_15+RURAL": 140000,
  ...over,
});
const ep = (over) => ({ date: "2026-01-05", program: "ถกไม่เถียง", channel: "One31", topic: "จากไฟล์", topicType: "x", durationMin: 40, rating: 0.3, bkk: 0.4, urban: 0.5, bkkUrban: 0.45, rural: 0.2, viewers: 0, ...over });
const digital = { Date: "2026-01-05", Platform: "YouTube", URL: "https://www.youtube.com/watch?v=abcdefghijk", Views: "10" };

test("merge: copies collapse, blanks fill, team columns stay, digital untouched", () => {
  const rows = [digital, tvRow({}), tvRow({ Channel: "ONE31", Topic: "", Notes: "legacy" })];
  const r = mergeTvEpisodes(rows, [ep({ rating: 0.3 }), ep({ date: "2026-01-06" })]);
  assert.equal(r.removed.length, 1);
  assert.equal(r.inserted.length, 1);
  const kept = r.rows.find((x) => x.Platform === "TV" && x.Date === "2026-01-05");
  assert.equal(kept.Topic, "ทีมกรอก"); // team's topic, not the workbook's
  assert.equal(kept.Notes, "legacy"); // blank filled from the removed copy
  assert.equal(r.rows[0], digital);
  const checks = validateTv(rows, r, [ep({}), ep({ date: "2026-01-06" })]);
  assert.ok(checks.every((c) => c.pass), JSON.stringify(checks.filter((c) => !c.pass)));
});

test("merge: copies with different ratings are left alone and reported", () => {
  const rows = [tvRow({}), tvRow({ Channel: "ONE31", TV_Rating_Total: 0.31 })];
  const r = mergeTvEpisodes(rows, [ep({})]);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.removed.length, 0);
  assert.equal(r.rows.length, 2);
});

test("merge: a revised rating updates the numbers and is flagged for review", () => {
  const rows = [tvRow({})];
  const r = mergeTvEpisodes(rows, [ep({ rating: 0.35 })]);
  assert.equal(r.updated.length, 1);
  assert.equal(r.rows[0].TV_Rating_Total, 0.35);
  assert.equal(r.rows[0].TV_Audience_Total, 245000);
  const c15 = validateTv(rows, r, [ep({ rating: 0.35 })]).find((c) => c.name.startsWith("15."));
  assert.ok(c15.pass);
  assert.ok(c15.warnings.some((w) => w.includes("0.3 → 0.35")));
});

test("validation blocks a changed team column on a TV row", () => {
  const rows = [tvRow({})];
  const r = mergeTvEpisodes(rows, [ep({})]);
  r.rows[0] = { ...r.rows[0], Topic: "แก้เอง" };
  const c13 = validateTv(rows, r, [ep({})]).find((c) => c.name.startsWith("13."));
  assert.equal(c13.pass, false);
});
