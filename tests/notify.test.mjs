import assert from "node:assert/strict";
import test from "node:test";
import { buildEmail, cleanRecipients, sendEmail, shouldNotify } from "../lib/integrations/notify.ts";

const report = (over = {}) => ({
  runId: "2026-10-01T23-00-00Z", status: "success", trigger: "schedule",
  startedAt: "2026-10-01T23:00:00Z", finishedAt: "2026-10-01T23:04:00Z",
  window: { since: "2026-07-03", until: "2026-10-02" }, message: "อัปเดต 120 · ใหม่ 15",
  platforms: { Facebook: { ok: true, latestPost: "2026-10-01" }, TikTok: { ok: false, latestPost: "", error: "HTTP 500" } },
  sources: [], totals: { updated: 120, inserted: 15, tvUpdated: 2, tvInserted: 1 },
  checks: [{ name: "1. ไม่มีข้อมูลหาย", pass: true, detail: "ok" }],
  tvSources: [{ id: "a", name: "ถกไม่เถียง ONE31", ok: true, episodes: 190, from: "upload" }],
  ...over,
});

test("when to send", () => {
  assert.equal(shouldNotify("always", "success"), true);
  assert.equal(shouldNotify("problems", "success"), false);
  assert.equal(shouldNotify("problems", "blocked"), true);
  assert.equal(shouldNotify("problems", "failed"), true);
  assert.equal(shouldNotify("off", "failed"), false);
});

test("recipients: valid, unique, at most 10", () => {
  assert.deepEqual(cleanRecipients([" A@x.com ", "a@x.com", "bad", "b@y.co; c@z.com", "c@z.com"]), ["a@x.com", "c@z.com"]);
  assert.equal(cleanRecipients(Array.from({ length: 15 }, (_, i) => `u${i}@x.com`)).length, 10);
  assert.deepEqual(cleanRecipients(undefined), []);
});

test("email content: status, numbers, failed checks, escaped text", () => {
  const ok = buildEmail(report());
  assert.match(ok.subject, /สำเร็จ/);
  assert.match(ok.html, /120 \/ 15 แถว/);
  assert.match(ok.html, /ไฟล์ที่อัปโหลด/);
  assert.match(ok.html, /TikTok: ดึงไม่ได้/);
  const blocked = buildEmail(report({ status: "blocked", message: "<script>x</script>", checks: [{ name: "7. ยอดรายเดือน", pass: false, detail: "ลด" }] }));
  assert.match(blocked.subject, /ไม่ผ่านการตรวจ/);
  assert.match(blocked.html, /7\. ยอดรายเดือน — ลด/);
  assert.ok(!blocked.html.includes("<script>"));
  assert.match(blocked.text, /ไม่ผ่าน: 7\./);
  assert.match(buildEmail(report({ runId: "test" })).subject, /อีเมลทดสอบ/);
});

test("sending: ok, refused and network errors are reported, never thrown", async () => {
  const real = globalThis.fetch;
  try {
    let sent;
    globalThis.fetch = async (_u, init) => {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true, sent: 1 }), { status: 200 });
    };
    assert.deepEqual(await sendEmail("https://script.example/exec", "tok", ["a@x.com"], buildEmail(report())), { ok: true });
    assert.equal(sent.token, "tok");
    assert.deepEqual(sent.to, ["a@x.com"]);

    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200 });
    assert.deepEqual(await sendEmail("u", "bad", ["a@x.com"], buildEmail(report())), { ok: false, error: "unauthorized" });

    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.deepEqual(await sendEmail("u", "t", ["a@x.com"], buildEmail(report())), { ok: false, error: "offline" });
  } finally {
    globalThis.fetch = real;
  }
});
