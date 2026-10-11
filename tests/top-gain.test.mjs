import assert from "node:assert/strict";
import test from "node:test";
import { gainShare } from "../lib/dashboard/growth.ts";

test("share of lifetime views gained in the range: capped at 100%, none without views", () => {
  assert.equal(gainShare({ views: 50, row: { views: 200 } }), 0.25);
  assert.equal(gainShare({ views: 300, row: { views: 200 } }), 1);
  assert.equal(gainShare({ views: 10, row: { views: 0 } }), null);
  assert.equal(gainShare({ views: 0, row: { views: 100 } }), null);
});
