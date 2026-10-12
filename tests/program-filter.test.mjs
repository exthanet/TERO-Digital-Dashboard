import assert from "node:assert/strict";
import test from "node:test";
import { programLabel, programList, programMatches, programValue } from "../lib/dashboard/programFilter.ts";

const options = ["ถกไม่เถียง", "เงินทองของจริง", "Kidsfun"];

test("one, several or every program", () => {
  assert.equal(programList("ALL"), null);
  assert.deepEqual(programList("ถกไม่เถียง"), ["ถกไม่เถียง"]);
  assert.deepEqual(programList("ถกไม่เถียง|Kidsfun"), ["ถกไม่เถียง", "Kidsfun"]);
  assert.equal(programMatches("ALL", "x"), true);
  assert.equal(programMatches("ถกไม่เถียง|Kidsfun", "Kidsfun"), true);
  assert.equal(programMatches("ถกไม่เถียง|Kidsfun", "เงินทองของจริง"), false);
});

test("none or all picked is ALL; order follows the options", () => {
  assert.equal(programValue([], options), "ALL");
  assert.equal(programValue([...options], options), "ALL");
  assert.equal(programValue(["Kidsfun", "ถกไม่เถียง"], options), "ถกไม่เถียง|Kidsfun");
  assert.equal(programLabel("ALL"), "ทั้งหมด");
  assert.equal(programLabel("Kidsfun"), "Kidsfun");
  assert.equal(programLabel("ถกไม่เถียง|Kidsfun"), "ถกไม่เถียง, Kidsfun");
});
