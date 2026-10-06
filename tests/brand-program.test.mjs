import assert from "node:assert/strict";
import test from "node:test";
import { programFor } from "../lib/integrations/metricoolSync.ts";

test("a locked account keeps its own program; others follow a show named in the title", () => {
  const news = { blogId: 1, label: "TERO News", mode: "single", program: "TERO News", lockProgram: true, enabled: true };
  const thok = { blogId: 2, label: "ถกไม่เถียง", mode: "single", program: "ถกไม่เถียง", enabled: true };
  assert.equal(programFor(news, "คลิปจาก ถกไม่เถียง #ถกไม่เถียง", "ถกไม่เถียง"), "TERO News");
  assert.equal(programFor(thok, "เงินทองของจริง EP.1", "เงินทองของจริง"), "เงินทองของจริง");
  assert.equal(programFor(thok, "ข่าวทั่วไป", "ไม่ระบุ"), "ถกไม่เถียง");
});
