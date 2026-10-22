import test from "node:test";
import assert from "node:assert/strict";
import { vsNormal, vsNormalTone } from "../lib/dashboard/vsNormal.ts";

test("against normal: times above, the share missing below, near normal within 5%", () => {
  assert.equal(vsNormal(2.31), "ดีกว่าปกติ 2.3 เท่า");
  assert.equal(vsNormal(0.4), "ต่ำกว่าปกติ 60%");
  assert.equal(vsNormal(0.18), "ต่ำกว่าปกติ 82%");
  assert.equal(vsNormal(1.02), "ใกล้เคียงปกติ");
  assert.equal(vsNormal(0.97), "ใกล้เคียงปกติ");
  assert.equal(vsNormal(1.05), "ดีกว่าปกติ 1.1 เท่า");
  assert.deepEqual([vsNormalTone(1.5), vsNormalTone(0.5), vsNormalTone(1)], ["up", "down", ""]);
});
