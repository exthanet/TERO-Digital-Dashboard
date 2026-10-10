import assert from "node:assert/strict";
import test from "node:test";
import { topWords, wordsOf } from "../lib/dashboard/commentWords.ts";

test("Thai words are cut; particles, links, tags, numbers and repeats are left out", () => {
  const w = wordsOf("รัฐบาลต้องชี้แจงครับ https://x.y/z #ถกไม่เถียง 555 ๆๆ");
  assert.ok(w.includes("รัฐบาล"));
  assert.ok(w.includes("ชี้แจง"));
  assert.ok(!w.includes("ครับ"));
  assert.ok(!w.some((x) => x.includes("http") || x.includes("ถกไม่เถียง") || x === "555"));
});

test("top words: a word counts once per comment, at least 2 comments, most used first", () => {
  const c = [
    { id: "1", text: "รัฐบาล รัฐบาล รัฐบาล ต้องชี้แจง" },
    { id: "2", text: "รัฐบาลควรชี้แจงเรื่องงบ" },
    { id: "3", text: "งบประมาณ รัฐบาล" },
    { id: "3", text: "รัฐบาล" }, // same comment in both lists
  ];
  const t = topWords(c);
  assert.deepEqual(t[0], { word: "รัฐบาล", comments: 3 });
  assert.ok(t.some((x) => x.word === "ชี้แจง" && x.comments === 2));
  assert.ok(!t.some((x) => x.comments < 2));
});
