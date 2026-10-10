import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { clipDetail, gainedByPlatform, normTitle, siblingsOf } from "../lib/dashboard/clipDetail.ts";

const row = (platform, url, topic, date, views, extra = {}) =>
  normalize({ Date: date, Program: "ถกไม่เถียง", Topic: topic, Platform: platform, VDO_Type: `${platform} Clip`, URL: url, Views: String(views), ...extra });
const yt = (id, topic, date, views, extra) => row("YouTube", `https://www.youtube.com/watch?v=${id.padEnd(11, "x")}`, topic, date, views, extra);
const tk = (id, topic, date, views, extra) => row("TikTok", `https://www.tiktok.com/@a/video/${String(id).padEnd(19, "0")}`, topic, date, views, extra);

test("titles match without hashtags, spaces or case", () => {
  assert.equal(normTitle("ข่าวด่วน !  สภาฯ #ถกไม่เถียง #ข่าว"), normTitle("ข่าวด่วน ! สภาฯ"));
});

test("same programme, same title, within 3 days; others stay out", () => {
  const clip = yt("a", "เรื่องเดียวกัน #ถกไม่เถียง", "2026-09-10", 1000);
  const rows = [
    clip,
    tk(1, "เรื่องเดียวกัน", "2026-09-11", 500),
    tk(2, "เรื่องเดียวกัน", "2026-09-20", 500), // too late
    { ...tk(3, "เรื่องเดียวกัน", "2026-09-10", 500), program: "รายการอื่น" },
    tk(4, "เรื่องอื่น", "2026-09-10", 500),
  ];
  const { posts, byTitle } = siblingsOf(clip, rows);
  assert.equal(byTitle, true);
  assert.deepEqual(posts.map((r) => r.url.slice(-4)), [clip.url.slice(-4), rows[1].url.slice(-4)]);
});

test("daily gains add up per platform; normal is the median of the 30 days before", () => {
  const clip = yt("a", "คลิป", "2026-09-10", 3000, { Publish_Time: "19:05" });
  const sib = tk(1, "คลิป", "2026-09-10", 1000);
  const history = [100, 200, 300].map((v, i) => yt(`h${i}`, `เก่า${i}`, "2026-09-01", v, { Publish_Time: "19:00" }));
  const days = new Map([
    ["2026-09-10", [["YouTube|axxxxxxxxxx", 2000, 10, 1, 0, 1], [`TikTok|${"1".padEnd(19, "0")}`, 600, 5, 0, 0, 1], ["YouTube|other00000x", 9, 0, 0, 0, 0]]],
    ["2026-09-11", [["YouTube|axxxxxxxxxx", 1000, 0, 0, 0, 0]]],
    ["2026-09-12", null],
  ]);
  const d = clipDetail(clip, [clip, sib, ...history], days, ["2026-09-10", "2026-09-11", "2026-09-12"]);
  assert.equal(d.totalViews, 4000);
  assert.equal(d.gained, 3600);
  assert.deepEqual(d.daily.map((x) => x.total), [2600, 1000, 0]);
  assert.deepEqual(d.daily.map((x) => x.cumulative), [2600, 3600, 3600]);
  assert.equal(d.daysWithData, 2);
  assert.deepEqual(d.peak, { date: "2026-09-10", views: 2600 });
  const ytPost = d.posts.find((p) => p.row.platform === "YouTube");
  assert.equal(ytPost.baseline, 200);
  assert.equal(ytPost.index, 15);
  assert.equal(ytPost.hour, 19);
  assert.equal(ytPost.hourMedian, 200);
  assert.equal(ytPost.hours.length, 24);
  assert.deepEqual(ytPost.hours[19], { hour: 19, clips: 3, median: 200 });
  assert.deepEqual(ytPost.hours[18], { hour: 18, clips: 0, median: null });
  assert.deepEqual(gainedByPlatform(d), [{ name: "YouTube", total: 3000 }, { name: "TikTok", total: 600 }]);
});
