import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { earlySignals, newClips, postedAt, runIdTime } from "../lib/dashboard/earlySignal.ts";

const tk = (n, date, time, extra = {}) =>
  normalize({ Date: date, Publish_Time: time, Program: "ถกไม่เถียง", Topic: `clip ${n}`, Platform: "TikTok", VDO_Type: "TikTok", URL: `https://www.tiktok.com/@a/video/9${String(n).padStart(18, "0")}`, Views: "1", ...extra });
const key = (n) => `TikTok|9${String(n).padStart(18, "0")}`;

test("sync run ids and Bangkok posting times become ms", () => {
  assert.equal(runIdTime("2026-10-02T09-03-37Z"), Date.parse("2026-10-02T09:03:37Z"));
  assert.equal(runIdTime("bad"), null);
  assert.equal(postedAt(tk(1, "2026-10-01", "19:05")), Date.parse("2026-10-01T12:05:00Z"));
  assert.equal(postedAt(tk(1, "2026-10-01", "")), null);
});

test("views per hour since posting, ranked within the same programme, platform and format", () => {
  // Sync for growth day 10-01 ran 10-02 05:00 Bangkok (= 10-01 22:00 UTC).
  const sync = new Map([["2026-10-01", Date.parse("2026-10-01T22:00:00Z")]]);
  const rows = [];
  const entries = [];
  // 21 peers posted at 19:00 (10 h before the sync) with 100…2100 views.
  for (let i = 1; i <= 21; i++) {
    rows.push(tk(i, "2026-10-01", "19:00"));
    entries.push([key(i), i * 100, 0, 0, 0, 1]);
  }
  // Posted 04:00 (1 h before the sync) with 2,000 views: fastest per hour.
  rows.push(tk(99, "2026-10-02", "04:00"));
  entries.push([key(99), 2000, 0, 5, 10, 1]);
  // No posting time: measured but not ranked.
  rows.push(tk(77, "2026-10-01", ""));
  entries.push([key(77), 500, 0, 0, 0, 1]);
  // Not new that day: ignored.
  entries.push([key(1) + "0", 9999, 0, 0, 0, 0]);

  const clips = earlySignals(new Map([["2026-10-01", entries]]), sync, rows);
  const fast = clips.find((c) => c.key === key(99));
  assert.equal(fast.hours, 1);
  assert.equal(fast.perHour, 2000);
  assert.equal(fast.peers, 21);
  assert.equal(fast.percentile, 1);
  assert.equal(fast.level, "hot");
  const slow = clips.find((c) => c.key === key(1));
  assert.equal(slow.perHour, 10);
  assert.equal(slow.level, "normal");
  assert.equal(clips.find((c) => c.key === key(77)).level, "none");

  // Listed: posted from 3 days before the latest growth day, filtered rows only, fastest first.
  const listed = newClips(clips, "2026-10-01", new Set([key(99), key(1), key(77)]));
  assert.deepEqual(listed.map((c) => c.key), [key(99), key(1), key(77)]);
});

test("small groups say so instead of ranking", () => {
  const sync = new Map([["2026-10-01", Date.parse("2026-10-01T22:00:00Z")]]);
  const rows = [tk(1, "2026-10-01", "19:00"), tk(2, "2026-10-01", "20:00")];
  const clips = earlySignals(new Map([["2026-10-01", [[key(1), 100, 0, 0, 0, 1], [key(2), 50, 0, 0, 0, 1]]]]), sync, rows);
  assert.deepEqual(clips.map((c) => c.level), ["few", "few"]);
  assert.equal(clips[0].percentile, null);
});
