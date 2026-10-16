import assert from "node:assert/strict";
import test from "node:test";
import { mergeSheet, sheetIdOf } from "../lib/integrations/revenueSheet.ts";

const m = (month, est) => ({ month, monthLabel: month, year: 2026, estRevenue: est, partnerAdRevenue: est / 2, youtubePremiumRevenue: 1 });
const wb = (overall, extra = {}) => ({ overall, digital: null, entertainment: null, rates: null, unmatchedRates: 0, sheets: [], ...extra });

test("Google Sheet and Drive links give their file id; anything else none", () => {
  assert.equal(sheetIdOf("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0"), "1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
  assert.equal(sheetIdOf("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view"), "1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
  assert.equal(sheetIdOf("https://example.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345"), "");
  assert.equal(sheetIdOf(""), "");
});

test("merge like Import: sheet months replace, others stay; what is new or changed", () => {
  const current = { generatedAt: "", monthly: [m("2026-07", 10), m("2026-08", 20)], rates: { "2026-07": 33 } };
  const r = mergeSheet(current, wb([m("2026-08", 21), m("2026-09", 30)], { rates: { "2026-07": 33, "2026-09": 34 } }), "now");
  assert.deepEqual(r.data.monthly.map((x) => [x.month, x.estRevenue]), [["2026-07", 10], ["2026-08", 21], ["2026-09", 30]]);
  assert.deepEqual(r.added, ["2026-09"]);
  assert.deepEqual(r.changed, ["2026-08"]);
  assert.deepEqual(r.kept, ["2026-07"]);
  assert.deepEqual(r.data.rates, { "2026-07": 33, "2026-09": 34 });
  assert.equal(r.problem, "");
});

test("the same numbers read back (null vs missing) are no change", () => {
  const stored = { ...m("2026-08", 20), superChatRevenue: null };
  const r = mergeSheet({ generatedAt: "", monthly: [stored] }, wb([m("2026-08", 20)]));
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.changed, []);
});

test("a sheet with no months is a problem, nothing to write", () => {
  assert.match(mergeSheet({ generatedAt: "", monthly: [m("2026-08", 20)] }, wb([])).problem, /ไม่พบข้อมูล/);
  assert.match(mergeSheet(null, wb(null)).problem, /Overall/);
});

test("no link: nothing is read, the status says so", async () => {
  const { checkSheet } = await import("../lib/integrations/revenueSheet.ts");
  const db = { get: async () => null, listRaw: async () => [] };
  const r = await checkSheet(db, { client_email: "sync@example.iam.gserviceaccount.com" }, () => {
    throw new Error("must not fetch");
  });
  assert.equal(r.draft, null);
  assert.equal(r.status.detail, "ยังไม่ได้ตั้งลิงก์");
  assert.equal(r.status.shareWith, "sync@example.iam.gserviceaccount.com");
});
