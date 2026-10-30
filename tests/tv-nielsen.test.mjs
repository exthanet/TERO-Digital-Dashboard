import test from "node:test";
import assert from "node:assert/strict";
import { episodeNumbers, mergeTvEpisodes, nielsenDay, parseTvSheet } from "../lib/integrations/tvSheet.ts";
import { episodeTitle, nameEpisodes, nameFromClips } from "../lib/integrations/tvEpisodeNames.ts";
import { validateTv } from "../lib/integrations/syncValidation.ts";

const HEAD = ["2nd Description (grouped)", "Date", "Day of week", "Start time", "End time", "Duration", "Level 2\\Target", "15+NW", "15+BKK", "15+URBAN", "15+BKK&URBAN", "15+RURAL", "Viewership (15+)"];
const tab = (...rows) => [["Variable", "Channel"], ["TVR", "ONE"], HEAD, ...rows];
const row = (date, dow, nw, dur = 0.0069444) => ["", date, dow, 0.327, 0.334, dur, "DOCUMENTARY", nw, 0.3, 0.2, 0.25, 0.1, ""];
const ngt = { channel: "One31", program: "เงินทองของจริง" };

test("Nielsen dates: Excel days, dd/mm/yyyy and Buddhist d/m/yy, each checked against the weekday", () => {
  assert.deepEqual(nielsenDay(46027, "Mon"), { date: "2026-01-05" });
  assert.deepEqual(nielsenDay("05/01/2026", "Mon"), { date: "2026-01-05" });
  assert.deepEqual(nielsenDay("9/3/69", "Mon"), { date: "2026-03-09" });
  // A mistyped year is read with the year of the rows before it, only when the weekday then fits.
  assert.equal(nielsenDay("11/02/2027", "Wed", 2026).date, "2026-02-11");
  assert.match(nielsenDay("11/02/2027", "Wed", 2026).fixed, /ปีพิมพ์ผิด/);
  // Weekday does not fit any reading: left out, never guessed.
  assert.equal(nielsenDay("8/03/2026", "Fri", 2026).date, "");
  assert.match(nielsenDay("8/03/2026", "Fri", 2026).problem, /ไม่ตรงกับวัน/);
  assert.equal(nielsenDay("Summary TV", "").date, "");
});

test("a Nielsen tab: 15+NW is the rating, duration in minutes, duplicates and bad dates reported", () => {
  const p = parseTvSheet(
    tab(row(46027, "Mon", 0.218), row("06/01/2026", "Tue", 0.215), row("06/01/2026", "Tue", 0.3), row("8/03/2026", "Fri", 0.14), row("07/01/2026", "Wed", ""), ["Summary TV ONE31+GMM25", "", "", "", "", "", "", 0.54]),
    ngt,
  );
  assert.deepEqual(p.missingColumns, []);
  assert.deepEqual(p.episodes.map((e) => [e.date, e.rating, e.durationMin, e.topic]), [["2026-01-05", 0.218, 10, ""], ["2026-01-06", 0.215, 10, ""]]);
  assert.deepEqual(p.pending, ["2026-01-07"]);
  assert.equal(p.problems.length, 2);
  assert.match(p.problems[0], /^แถว 6: วันที่ 2026-01-06 ซ้ำกับแถว 5/);
  assert.match(p.problems[1], /^แถว 7: .*ไม่ได้นำเข้า/);
  // Audience follows the existing rule.
  assert.equal(episodeNumbers(p.episodes[0]).TV_Audience_Total, 152600);
});

test("the old layout (ถกไม่เถียง tabs) is read as before", () => {
  const p = parseTvSheet([["วันที่", "ประเด็น", "เรตติง ONE", "15+BKK", "15+URBAN", "15+BKK&URBAN", "15+RURAL"], ["5 ม.ค. 2026", "เรื่อง", 0.5, 0.4, 0.3, 0.35, 0.2]], { channel: "One31", program: "ถกไม่เถียง" });
  assert.deepEqual(p.episodes.map((e) => [e.date, e.topic, e.rating]), [["2026-01-05", "เรื่อง", 0.5]]);
  assert.equal(p.problems, undefined);
});

const clip = (Platform, VDO_Type, Topic, Date = "2026-09-15") => ({ Platform, VDO_Type, Topic, Date, Program: "เงินทองของจริง" });
const day = [
  clip("YouTube", "Youtube Live", "🔴 [LIVE] เปิดแนวคิดการลงทุน | เงินทองของจริง | วันที่ 15 กันยายน"),
  clip("YouTube", "Youtube Highlight", "[Highlight] | เงินทองของจริง EP.181 เทรนด์โลกเปลี่ยน | 14 ก.ย. 69"),
  clip("YouTube", "YouTube Full Episode", "ลงทุนอสังหาฯ อย่างมืออาชีพ ! | เงินทองของจริง FULL EP.182 | 15 ก.ย. 69"),
  clip("TikTok", "TikTok", "ซื้อบ้านเพื่ออยู่ | เงินทองของจริง"),
  clip("Facebook", "Facebook Reels", "ซื้อบ้านเพื่ออยู่ | เงินทองของจริง"),
  { ...clip("YouTube", "Video Episode", "ถกไม่เถียง คลิปอื่น"), Program: "ถกไม่เถียง" },
];

test("episode name: the FULL EP first, its EP number, and the day's clips per platform", () => {
  assert.equal(episodeTitle("🔴 [LIVE] ครม.ไฟเขียว ! | เงินทองของจริง | วันที่ 28"), "ครม.ไฟเขียว !");
  const n = nameFromClips(day, "เงินทองของจริง", "2026-09-15");
  assert.deepEqual(n, { topic: "ลงทุนอสังหาฯ อย่างมืออาชีพ !", episodeId: "EP.182", from: "YouTube FULL EP", clips: { YouTube: 3, Facebook: 1, Instagram: 0, TikTok: 1 }, total: 5 });
  // No full episode that day: the LIVE; nothing at all: no name, waiting.
  assert.equal(nameFromClips(day.filter((r) => !/FULL EP/.test(r.Topic)), "เงินทองของจริง", "2026-09-15").from, "YouTube LIVE");
  assert.deepEqual(nameFromClips(day, "เงินทองของจริง", "2026-09-16"), { topic: "", episodeId: "", from: "", clips: { YouTube: 0, Facebook: 0, Instagram: 0, TikTok: 0 }, total: 0 });
});

test("named episodes go in as new rows; a later run fills only the blanks", () => {
  const base = { Platform: "TV", Date: "2026-01-01", Program: "ถกไม่เถียง", Channel: "One31", Topic: "เดิม", Notes: "ทีม", TV_Rating_Total: 0.5 };
  const eps = parseTvSheet(tab(row("15/09/2026", "Tue", 0.2), row("16/09/2026", "Wed", 0.25)), ngt).episodes;
  const naming = nameEpisodes(eps, [...day, base]);
  assert.deepEqual(naming, { named: 1, waiting: ["2026-09-16 One31"] });
  const first = mergeTvEpisodes([base, ...day], eps);
  const r15 = first.inserted.find((r) => r.Date === "2026-09-15");
  assert.equal(r15.Topic, "ลงทุนอสังหาฯ อย่างมืออาชีพ !");
  assert.equal(r15.Episode_ID, "EP.182");
  assert.equal(r15.Topic_Type, "การเงิน / ธุรกิจ");
  assert.match(r15.Notes, /ชื่อตอนจาก YouTube FULL EP · คลิปวันนั้น 5 \(YouTube 3 · Facebook 1 · TikTok 1\)/);
  assert.equal(first.inserted.find((r) => r.Date === "2026-09-16").Topic, "");
  // Next day the clips of the 16th exist: the blank name is filled, nothing else on other rows.
  const later = [...first.rows, clip("YouTube", "YouTube Full Episode", "ตอนใหม่ | เงินทองของจริง FULL EP.183", "2026-09-16")];
  const eps2 = parseTvSheet(tab(row("15/09/2026", "Tue", 0.2), row("16/09/2026", "Wed", 0.25)), ngt).episodes;
  nameEpisodes(eps2, later);
  const second = mergeTvEpisodes(later, eps2);
  assert.equal(second.inserted.length, 0);
  assert.deepEqual(second.named.map((n) => n.key), ["2026-09-16|เงินทองของจริง|One31"]);
  assert.equal(second.rows.find((r) => r.Platform === "TV" && r.Date === "2026-09-16").Topic, "ตอนใหม่");
  assert.equal(second.rows.find((r) => r.Program === "ถกไม่เถียง" && r.Platform === "TV"), base);
  const checks = validateTv(later, second, eps2);
  assert.ok(checks.every((c) => c.pass), JSON.stringify(checks.filter((c) => !c.pass)));
});

test("a name the team typed is never replaced", () => {
  const typed = { Platform: "TV", Date: "2026-09-15", Program: "เงินทองของจริง", Channel: "One31", Topic: "ชื่อที่ทีมพิมพ์", Notes: "ทีม", TV_Rating_Total: 0.2 };
  const eps = parseTvSheet(tab(row("15/09/2026", "Tue", 0.2)), ngt).episodes;
  nameEpisodes(eps, day);
  const m = mergeTvEpisodes([typed, ...day], eps);
  const r = m.rows.find((x) => x.Platform === "TV");
  assert.equal(r.Topic, "ชื่อที่ทีมพิมพ์");
  assert.equal(r.Notes, "ทีม");
});
