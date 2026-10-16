import assert from "node:assert/strict";
import test from "node:test";
import { sourceMatrix } from "../lib/sync/sourceMatrix.ts";

const run = [
  { brand: "TERO Digital", network: "facebook", fetched: 10 },
  { brand: "TERO Digital", network: "fbreels", fetched: 5 },
  { brand: "TERO Digital", network: "tiktok", fetched: 8 },
  { brand: "TERO Digital", network: "tiktok-api", source: "api", fetched: 1186 },
  { brand: "TERO Digital", network: "youtube", fetched: 9 },
  { brand: "TERO Digital", network: "youtube-analytics", fetched: 9 },
  { brand: "TERO Digital", network: "youtube-data-api", fetched: 9 },
  { brand: "TERO Digital", network: "instagram", error: "no instagram connection for blog 1" },
  { brand: "HITZ", network: "facebook", fetched: 3 },
  { brand: "HITZ", network: "tiktok", fetched: 2 },
  { brand: "HITZ", network: "youtube", fetched: 4 },
  { brand: "HITZ", network: "youtube-data-api", fetched: 0 },
  { brand: "Kids", network: "tiktok", fetched: 1 },
  { brand: "Kids", network: "tiktok-api", source: "metricool", error: "TikTok API ใช้ไม่ได้" },
  { brand: "News", network: "facebook", error: "HTTP 500" },
];

test("which brand and platform is on an API, and which still comes through Metricool", () => {
  const m = sourceMatrix(run);
  const cell = (b, p) => m.rows.find((r) => r.brand === b).cells[p];
  assert.deepEqual(m.rows.map((r) => r.brand), ["TERO Digital", "HITZ", "Kids", "News"]);
  assert.equal(cell("TERO Digital", "TikTok").kind, "api");
  assert.equal(cell("TERO Digital", "TikTok").note, "1,186 คลิป");
  assert.equal(cell("TERO Digital", "YouTube").kind, "api");
  assert.match(cell("TERO Digital", "YouTube").note, /Analytics/);
  // A network the brand never connected in Metricool is no failure, just absent.
  assert.equal(cell("TERO Digital", "Instagram").kind, "none");
  assert.equal(cell("TERO Digital", "Facebook").kind, "metricool");
  assert.equal(cell("HITZ", "YouTube").note, "0 คลิปในช่วงนี้");
  assert.equal(cell("HITZ", "Instagram").kind, "none");
  assert.equal(cell("Kids", "TikTok").kind, "fallback");
  assert.equal(cell("News", "Facebook").kind, "error");
  assert.deepEqual(m.notOnApi, { Facebook: 3, Instagram: 0, TikTok: 1, YouTube: 0 });
  assert.equal(m.notOnApiTotal, 4);
  assert.deepEqual(m.noAnalytics, ["HITZ"]);
  assert.deepEqual(m.hasAnalytics, ["TERO Digital"]);
});

test("an old run without sources shows nothing", () => {
  assert.equal(sourceMatrix(undefined), null);
  assert.equal(sourceMatrix([]), null);
});
