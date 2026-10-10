import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_LAYOUT, cleanLayout, movePage, orderedIds, pageIds } from "../lib/dashboard/reportLayout.ts";

test("page ids: cover, titles, repeated titles and untitled pages", () => {
  assert.deepEqual(pageIds([{ cover: true }, { title: "TV" }, { title: "TV" }, {}]), ["cover", "TV", "TV#2", "page-4"]);
});

test("order: the admin's order; unknown old ids dropped; new pages next to their neighbour", () => {
  const ids = ["cover", "a", "b", "c", "d"];
  assert.deepEqual(orderedIds(ids, null), ids);
  assert.deepEqual(orderedIds(ids, EMPTY_LAYOUT), ids);
  // "d" was added later; "gone" no longer exists; "b" moved to the end.
  assert.deepEqual(orderedIds(ids, { order: ["cover", "a", "c", "gone", "b"], hidden: [], texts: {} }), ["cover", "a", "c", "d", "b"]);
  // A new first page goes first.
  assert.deepEqual(orderedIds(["new", ...ids], { order: ids, hidden: [], texts: {} }), ["new", ...ids]);
});

test("move up / down, not past the ends", () => {
  assert.deepEqual(movePage(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(movePage(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(movePage(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(movePage(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
});

test("clean: trimmed texts, empty ones and unknown pages left out, full order kept", () => {
  const l = cleanLayout({ order: ["b", "a"], hidden: ["a", "gone"], texts: { a: { title: "  หัวข้อใหม่ ", note: " " }, b: { note: "" }, gone: { title: "x" } } }, ["a", "b", "c"]);
  assert.deepEqual(l, { order: ["b", "c", "a"], hidden: ["a"], texts: { a: { title: "หัวข้อใหม่" } } });
});
