import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { computeAdvice, groupName, timeSlot } from "../lib/dashboard/advice.ts";

let seq = 0;
const clip = (o = {}) => {
  seq++;
  return normalize({
    Date: "2026-09-10", Program: "ถกไม่เถียง", Topic: `c${seq}`, Platform: "YouTube", VDO_Type: "Shorts",
    URL: `https://www.youtube.com/watch?v=${String(seq).padStart(11, "0")}`, Views: "1000", Likes: "10", Comments: "0", Shares: "0",
    Topic_Type: "ข่าวการเมือง", ...o,
  });
};
const many = (n, o) => Array.from({ length: n }, (_, i) => clip(typeof o === "function" ? o(i) : o));
const rules = (res) => res.items.map((a) => a.rule);

test("group names do not repeat the platform", () => {
  assert.equal(groupName({ platform: "YouTube", vdoType: "YouTube Shorts" }), "YouTube Shorts");
  assert.equal(groupName({ platform: "TikTok", vdoType: "Short" }), "TikTok Short");
});

test("time slots by Bangkok posting time", () => {
  assert.equal(timeSlot("06:30"), "เช้า 05:00–10:59");
  assert.equal(timeSlot("15:59"), "กลางวัน 11:00–15:59");
  assert.equal(timeSlot("20:00"), "เย็น 16:00–20:59");
  assert.equal(timeSlot("02:10"), "ดึก 21:00–04:59");
  assert.equal(timeSlot(""), null);
});

test("too few clips: no advice, and the page is told which rules lacked data", () => {
  const res = computeAdvice(many(5, {}), [], "2026-09-30");
  assert.equal(res.items.length, 0);
  assert.ok(res.notEnough.some((r) => r.rule === 1));
});

test("rule 1: length bucket with the higher median views wins", () => {
  const rows = [
    ...many(10, (i) => ({ Video_Length_Sec: "35", Avg_Watch_Sec: "20", Views: String(3000 + i) })),
    ...many(10, (i) => ({ Video_Length_Sec: "75", Avg_Watch_Sec: "25", Views: String(1000 + i) })),
  ];
  const a = computeAdvice(rows, [], "2026-09-30").items.find((x) => x.rule === 1);
  assert.ok(a);
  assert.match(a.title, /30–45 วิ/);
  assert.match(a.seen, /ดูเฉลี่ย 57%/); // 20 of 35 seconds, shown as context
});

test("rule 1: a small difference is checked but not advised", () => {
  const rows = [...many(10, { Video_Length_Sec: "35", Views: "1100" }), ...many(10, { Video_Length_Sec: "75", Views: "1000" })];
  const res = computeAdvice(rows, [], "2026-09-30");
  assert.ok(!rules(res).includes(1));
  assert.ok(res.nothingFound.some((r) => r.rule === 1));
});

test("rule 2: Reels skipped early are flagged against the channel median", () => {
  const rows = [
    ...many(10, { Platform: "Instagram", VDO_Type: "Instagram Reels", URL: "", Skip_Rate: "50", Views: "500" }),
    ...many(3, { Platform: "Instagram", VDO_Type: "Instagram Reels", URL: "", Skip_Rate: "80", Views: "500" }),
  ];
  const a = computeAdvice(rows, [], "2026-09-30").items.find((x) => x.rule === 2);
  assert.ok(a);
  assert.equal(a.clips.length, 3);
  assert.equal(a.level, "warn");
});

test("rule 3: a topic type well above or below its format's median", () => {
  const rows = [
    ...many(8, { Topic_Type: "บันเทิง", Views: "5000" }),
    ...many(12, { Topic_Type: "ข่าวการเมือง", Views: "1000" }),
  ];
  const items = computeAdvice(rows, [], "2026-09-30").items.filter((x) => x.rule === 3);
  assert.ok(items.some((a) => a.level === "good" && a.title.includes("บันเทิง")));
});

test("rule 4: high ER but low views", () => {
  const rows = [
    ...many(10, { Views: "1000", Likes: "10" }),
    ...many(3, { Views: "300", Likes: "30" }),
  ];
  const a = computeAdvice(rows, [], "2026-09-30").items.find((x) => x.rule === 4);
  assert.ok(a);
  assert.equal(a.clips.length, 3);
});

test("rule 5: more clips, fewer views each, against the compare range", () => {
  const now = many(13, { Views: "700" });
  const prev = many(10, { Views: "1000", Date: "2026-08-10" });
  const a = computeAdvice(now, prev, "2026-09-30").items.find((x) => x.rule === 5);
  assert.ok(a);
  assert.match(a.seen, /10 → 13/);
});

test("rule 6 and 7: weekday and posting time", () => {
  // 2026-09-06 is a Sunday, 2026-09-07 a Monday.
  const rows = [
    ...many(8, { Date: "2026-09-06", Publish_Time: "19:00", Views: "4000" }),
    ...many(8, { Date: "2026-09-07", Publish_Time: "08:00", Views: "1000" }),
  ];
  const res = computeAdvice(rows, [], "2026-09-30");
  assert.match(res.items.find((x) => x.rule === 6).title, /อาทิตย์/);
  assert.match(res.items.find((x) => x.rule === 7).title, /เย็น/);
});

test("clips from the last two days are left out of view comparisons", () => {
  const rows = [...many(10, { Date: "2026-09-29", Video_Length_Sec: "35", Views: "9000" }), ...many(10, { Date: "2026-09-29", Video_Length_Sec: "75" })];
  assert.equal(computeAdvice(rows, [], "2026-09-30").items.filter((a) => a.rule === 1).length, 0);
});

test("rule 1 leaves long-form formats alone (their length follows the broadcast)", () => {
  const rows = [
    ...many(10, { VDO_Type: "Video Episode", Video_Length_Sec: "4000", Views: "90000" }),
    ...many(10, { VDO_Type: "Video Episode", Video_Length_Sec: "1200", Views: "1000" }),
  ];
  assert.ok(!computeAdvice(rows, [], "2026-09-30").items.some((a) => a.rule === 1));
});
