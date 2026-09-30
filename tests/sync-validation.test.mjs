import assert from "node:assert/strict";
import test from "node:test";
import { mapPost, mergeIntoMaster } from "../lib/integrations/metricoolSync.ts";
import { validateMerge } from "../lib/integrations/syncValidation.ts";

const TERO = { blogId: 6487104, label: "TERO Digital", mode: "multi", enabled: true };
const base = () => [
  { Date: "2026-08-18", Program: "ถกไม่เถียง", Topic: "ทีมกรอก", Topic_Type: "ข่าวการเมือง", VDO_Type: "Shorts", Platform: "YouTube",
    Channel: "-", Content_ID: "", URL: "https://www.youtube.com/watch?v=zu18DUg143A", Views: "500", Likes: "1", Comments: "0", Shares: "0", Engagement: "1", Engagement_Rate: "0.20%", Notes: "" },
  { Date: "2026-08-18", Program: "ถกไม่เถียง", Topic: "เทป", Topic_Type: "ข่าวการเมือง", VDO_Type: "TV Episode", Platform: "TV",
    Channel: "ONE31", Content_ID: "", URL: "", Views: "0", Likes: "", Comments: "", Shares: "", Engagement: "0", Engagement_Rate: "0%", Notes: "", TV_Rating_Total: "0.33", TV_Audience_Total: "200000" },
];
const incoming = () => [
  mapPost("youtube", { videoId: "zu18DUg143A", title: "api", publishedAt: { dateTime: "2026-08-18T05:00:00", timezone: "Europe/Madrid" }, views: 900, likes: 2, comments: 1, shares: 0, videoType: "SHORT" }, TERO),
  mapPost("youtube", { videoId: "NEWvideo001", title: "#ถกไม่เถียง", publishedAt: { dateTime: "2026-08-19T05:00:00", timezone: "Europe/Madrid" }, views: 50, videoType: "SHORT" }, TERO),
];
const failed = (v) => v.checks.filter((c) => !c.pass).map((c) => c.name.slice(0, 2));

test("a clean merge passes every check", () => {
  const b = base();
  const v = validateMerge(b, mergeIntoMaster(b, incoming()));
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter((c) => !c.pass)));
});

test("changing a team column or a TV row is caught", () => {
  const b = base();
  const r = mergeIntoMaster(b, incoming());
  r.merged[0] = { ...r.merged[0], Program: "อื่น" };
  r.merged[1] = { ...r.merged[1], TV_Rating_Total: "0.99" };
  assert.deepEqual(failed(validateMerge(b, r)), ["2."]);
});

test("a lost row, a duplicate and a broken new row are caught", () => {
  const b = base();
  const r = mergeIntoMaster(b, incoming());
  r.merged.push({ ...r.merged[2] }); // duplicate of the new video
  const lost = { ...r, merged: r.merged.filter((_, i) => i !== 1) };
  assert.ok(failed(validateMerge(b, lost)).includes("1."));
  assert.ok(failed(validateMerge(b, r)).includes("3."));

  const r2 = mergeIntoMaster(b, incoming());
  r2.merged[2] = { ...r2.merged[2], Date: "not a date" };
  assert.ok(failed(validateMerge(b, r2)).includes("4."));
});

test("negative numbers and a monthly drop are caught", () => {
  const b = base();
  const r = mergeIntoMaster(b, incoming());
  r.merged[0] = { ...r.merged[0], Views: "10" }; // 500 → 10 makes August YouTube drop
  r.updated[0].after.Views = "-5";
  const f = failed(validateMerge(b, r));
  assert.ok(f.includes("5."));
  assert.ok(f.includes("7."));
});

test("a row stored as dd/mm/yyyy is caught (check 11)", () => {
  const b = base();
  const r = mergeIntoMaster(b, incoming());
  r.merged[0] = { ...r.merged[0], Date: "18/08/2026" };
  assert.ok(failed(validateMerge(b, r)).includes("11"));
});
