import assert from "node:assert/strict";
import test from "node:test";
import { bangkokTime, sendTelegram, syncMessage } from "../lib/integrations/telegram.ts";

const runUrl = "https://github.com/o/r/actions/runs/1";
const report = {
  status: "success",
  startedAt: "2026-10-08T22:17:00Z",
  totals: { updated: 3186, inserted: 7, rowsAfter: 35686 },
  platforms: { YouTube: { ok: true, latestPost: "" }, TikTok: { ok: true, latestPost: "" } },
  integrations: { "YouTube Analytics": { ok: true, detail: "" } },
  timings: [{ step: "ดึง TERO Digital", sec: 600 }, { step: "เขียนและตรวจ masterData", sec: 300 }, { step: "growth", sec: 20 }],
  message: "",
};

test("Bangkok time in Thai month names", () => {
  assert.equal(bangkokTime("2026-10-08T22:17:00Z"), "9 ต.ค. 05:17");
});

test("success: counts, total time, the two slowest steps and the run link", () => {
  const text = syncMessage(report, { jobStatus: "success", runUrl });
  assert.match(text, /^✅ Data sync 9 ต.ค. 05:17/);
  assert.match(text, /อัปเดต 3,186 · ใหม่ 7 · รวม 35,686 แถว/);
  assert.match(text, /15 นาที \(นานสุด: ดึง TERO Digital 10 นาที, เขียนและตรวจ masterData 5 นาที\)/);
  assert.ok(text.endsWith(runUrl));
  assert.doesNotMatch(text, /ควรดู/);
});

test("success with a platform problem names it", () => {
  const text = syncMessage({ ...report, platforms: { TikTok: { ok: false, latestPost: "" } } }, { jobStatus: "success", runUrl });
  assert.match(text, /ควรดู: TikTok/);
});

test("time limit: says whether the data was written", () => {
  assert.match(syncMessage(report, { jobStatus: "cancelled", runUrl }), /เกินเวลา[\s\S]*เขียนข้อมูลเสร็จแล้ว/);
  assert.match(syncMessage(null, { jobStatus: "cancelled", runUrl }), /เกินเวลา[\s\S]*ยังไม่ได้เขียนข้อมูล/);
});

test("blocked and failed runs carry the reason", () => {
  const blocked = syncMessage({ ...report, status: "blocked", message: "ไม่ได้เขียนข้อมูล เพราะไม่ผ่านการตรวจ: ข้อ 7" }, { jobStatus: "failure", runUrl });
  assert.match(blocked, /^⚠️ Data sync ไม่ผ่านการตรวจ/);
  assert.match(blocked, /ข้อ 7/);
  assert.match(syncMessage(null, { jobStatus: "failure", runUrl }), /^⚠️ Data sync ไม่สำเร็จ/);
});

test("test-run reports the job outcome, never a write", () => {
  assert.match(syncMessage(null, { jobStatus: "success", runUrl, mode: "test-run" }), /^🧪 .*ผ่านการตรวจ/);
  assert.match(syncMessage(null, { jobStatus: "failure", runUrl, mode: "test-run" }), /^⚠️ .*test-run ไม่ผ่าน/);
});

test("sendTelegram posts plain text to the chat and never reveals the token in errors", async () => {
  const calls = [];
  const ok = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true })); };
  assert.equal(await sendTelegram({ token: "SECRET", chatId: "-100" }, "hi", ok), "");
  assert.equal(calls[0].body.chat_id, "-100");
  assert.equal(calls[0].body.text, "hi");
  assert.equal(calls[0].body.parse_mode, undefined);
  const bad = async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 });
  const problem = await sendTelegram({ token: "SECRET", chatId: "x" }, "hi", bad);
  assert.match(problem, /chat not found/);
  assert.doesNotMatch(problem, /SECRET/);
  const down = async () => { throw new TypeError("fetch failed https://api.telegram.org/botSECRET/sendMessage"); };
  assert.doesNotMatch(await sendTelegram({ token: "SECRET", chatId: "x" }, "hi", down), /SECRET/);
});

test("TV line: new air days, latest rated day, waiting, source; an unread tab is named", () => {
  const tvReport = {
    ...report,
    tvSources: [
      { id: "a", name: "ถกไม่เถียง ONE31", ok: true, episodes: 200, pending: 15, from: "link" },
      { id: "b", name: "ถกไม่เถียง GMM25", ok: true, episodes: 196, pending: 15, from: "link" },
    ],
    tv: { inserted: ["2026-10-09", "2026-10-09"], updated: 0, latest: "2026-10-09" },
  };
  const text = syncMessage(tvReport, { jobStatus: "success", runUrl });
  assert.match(text, /\n📺 TV: ใหม่ 9\/10 · ล่าสุดมี rating 9\/10 · รอ rating 15 · จากลิงก์ SharePoint\n/);
  assert.doesNotMatch(text, /ควรดู/);
  const bad = syncMessage({ ...tvReport, tvSources: [{ id: "a", name: "ถกไม่เถียง ONE31", ok: false, error: "ลิงก์ 403" }], tv: { inserted: [], updated: 0, latest: "2026-10-09" } }, { jobStatus: "success", runUrl });
  assert.match(bad, /📺 TV: ไม่มีเทปใหม่ · ล่าสุดมี rating 9\/10/);
  assert.match(bad, /ควรดู: TV ถกไม่เถียง ONE31/);
  assert.doesNotMatch(syncMessage(report, { jobStatus: "success", runUrl }), /📺/);
});

test("a lost YouTube sign-in is said plainly, not only listed under ควรดู", () => {
  const text = syncMessage(
    { ...report, integrations: { "Monthly ACC": { ok: false, detail: "ไม่ได้ดึง", error: "ต้องล็อกอินใหม่: สิทธิ์ถูกยกเลิกหรือหมดอายุ (scripts/youtube-analytics-auth.mjs login --cms=…)" } } },
    { jobStatus: "success", runUrl },
  );
  assert.match(text, /ควรดู: Monthly ACC/);
  assert.match(text, /⚠️ Monthly ACC: ต้องล็อกอินใหม่/);
});
