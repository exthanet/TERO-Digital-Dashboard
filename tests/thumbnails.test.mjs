import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { earlyViews, rankThumbnails } from "../lib/dashboard/thumbnails.ts";
import { expiresAt, mergeThumbs, thumbOf } from "../lib/integrations/thumbnailWriter.ts";

const meta = (oeSeconds) => `https://scontent.fbkk1-1.fna.fbcdn.net/v/t15/x.jpg?stp=dst&oh=00_abc&oe=${oeSeconds.toString(16).toUpperCase()}`;

test("each network's cover field; YouTube and non-https links give none", () => {
  assert.equal(thumbOf("fbreels", { thumbnailUrl: "https://a/x.jpg" }), "https://a/x.jpg");
  assert.equal(thumbOf("facebook", { picture: "https://a/p.jpg" }), "https://a/p.jpg");
  assert.equal(thumbOf("reels", { imageUrl: "https://a/r.jpg" }), "https://a/r.jpg");
  assert.equal(thumbOf("tiktok", { coverImageUrl: "https://static.metricool.com/tkvideocovers/1/2-3.jpg" }), "https://static.metricool.com/tkvideocovers/1/2-3.jpg");
  assert.equal(thumbOf("youtube", { thumbnailUrl: "https://i.ytimg.com/vi/x/hq.jpg" }), "");
  assert.equal(thumbOf("tiktok", { coverImageUrl: "javascript:alert(1)" }), "");
});

test("Meta links expire by their oe parameter; others never", () => {
  const t = 1790000000;
  assert.equal(expiresAt(meta(t)), t * 1000);
  assert.equal(expiresAt("https://static.metricool.com/tkvideocovers/1/2-3.jpg"), Infinity);
});

test("merge keeps live links of posts still in masterData; fresh links win", () => {
  const now = 1790000000 * 1000;
  const old = { "Facebook|1": meta(1790000000 - 10), "Facebook|2": meta(1790000000 + 999), "TikTok|3": "https://m/3.jpg", "TikTok|9": "https://m/9.jpg" };
  const fresh = { "Facebook|1": meta(1790000000 + 300000) };
  const out = mergeThumbs(old, fresh, (k) => k !== "TikTok|9", now);
  assert.deepEqual(Object.keys(out).sort(), ["Facebook|1", "Facebook|2", "TikTok|3"]);
  assert.equal(out["Facebook|1"], fresh["Facebook|1"]);
});

test("first-two-day views need both days on file", () => {
  const days = new Map([
    ["2026-10-01", [["YouTube|a", 100, 0, 0, 0, 1], ["YouTube|b", 50, 0, 0, 0, 1]]],
    ["2026-10-02", [["YouTube|a", 40, 0, 0, 0, 0]]],
    ["2026-10-03", null],
  ]);
  const e = earlyViews(days);
  assert.deepEqual(e.get("YouTube|a"), { views: 140, first: "2026-10-01" });
  assert.deepEqual(e.get("YouTube|b"), { views: 50, first: "2026-10-01" }); // day 2 on file, no gain
  const gap = earlyViews(new Map([["2026-10-03", [["YouTube|c", 9, 0, 0, 0, 1]]], ["2026-10-04", null]]));
  assert.equal(gap.has("YouTube|c"), false);
});

test("clips are ranked by raw views, most first; fresh and zero-view clips wait", () => {
  const yt = (id, views, vdo, date = "2026-09-20") =>
    normalize({ Date: date, Program: "ถกไม่เถียง", Topic: id, Platform: "YouTube", VDO_Type: vdo, URL: `https://www.youtube.com/watch?v=${id.padEnd(11, "x")}`, Views: String(views) });
  const rows = [
    ...[100, 200, 300].map((v, i) => yt(`short${i}`, v, "Shorts")),
    ...[10000, 20000].map((v, i) => yt(`full${i}`, v, "Video Episode")),
    yt("zero", 0, "Shorts"),
    yt("newclip", 999999, "Shorts", "2026-09-30"),
  ];
  const { clips, fresh } = rankThumbnails(rows, "YouTube", "2026-09-30");
  assert.equal(fresh, 1);
  assert.deepEqual(clips.map((c) => c.row.topic), ["full1", "full0", "short2", "short1", "short0"]);
  assert.equal(clips[0].row.views, 20000);
});

test("cover links split into parts that each fit a document", async () => {
  const { packThumbs } = await import("../lib/integrations/thumbnailWriter.ts");
  const { gunzipSync } = await import("node:zlib");
  const { randomBytes } = await import("node:crypto");
  // Random-looking links so gzip cannot shrink them much.
  const links = Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`Facebook|${i}`, `https://scontent.example/${randomBytes(40).toString("hex")}`]));
  const parts = packThumbs(links, 60_000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 60_000));
  const back = Object.assign({}, ...parts.map((p) => JSON.parse(gunzipSync(p).toString("utf8"))));
  assert.deepEqual(back, links);
  assert.equal(packThumbs({}).length, 1);
});
