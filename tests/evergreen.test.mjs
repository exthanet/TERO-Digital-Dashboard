import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../lib/dashboard/normalize.ts";
import { daysBetween } from "../lib/dashboard/growth.ts";
import { bandOf, evergreen, evergreenMix } from "../lib/dashboard/evergreen.ts";

const yt = (id, topic, date, extra = {}) =>
  normalize({ Date: date, Program: "ถกไม่เถียง", Topic: topic, Topic_Type: "ข่าวการเมือง", Platform: "YouTube", VDO_Type: "YouTube Shorts", URL: `https://www.youtube.com/watch?v=${id.padEnd(11, "x")}`, Views: "1", ...extra });
const tk = (n, topic, date) =>
  normalize({ Date: date, Program: "ถกไม่เถียง", Topic: topic, Topic_Type: "ข่าวการเมือง", Platform: "TikTok", VDO_Type: "TikTok", URL: `https://www.tiktok.com/@a/video/9${String(n).padStart(18, "0")}`, Views: "1" });
const ytKey = (id) => `YouTube|${id.padEnd(11, "x")}`;
const tkKey = (n) => `TikTok|9${String(n).padStart(18, "0")}`;

test("age bands", () => {
  assert.equal(bandOf(14), "2w-1m");
  assert.equal(bandOf(30), "1-3m");
  assert.equal(bandOf(90), "1-3m");
  assert.equal(bandOf(91), "3m+");
});

test("old content gaining on 80%+ of days at 100+/day, added up across platforms; young or patchy content left out", () => {
  const range = daysBetween("2026-10-01", "2026-10-10");
  const rows = [
    yt("old", "คลิปเก่า #ถกไม่เถียง", "2026-08-01"),
    tk(1, "คลิปเก่า", "2026-08-02"),
    yt("young", "คลิปใหม่", "2026-10-01"),
    yt("patchy", "บางวัน", "2026-07-01"),
    yt("small", "วิวน้อย", "2026-07-01"),
  ];
  const days = new Map(
    range.map((d, i) => [
      d,
      [
        [ytKey("old"), 80, 0, 0, 0, 0],
        [tkKey(1), i < 5 ? 40 : 60, 0, 0, 0, 0],
        [ytKey("young"), 5000, 0, 0, 0, 0],
        [ytKey("patchy"), i % 2 ? 0 : 1000, 0, 0, 0, 0],
        [ytKey("small"), 50, 0, 0, 0, 0],
      ],
    ]),
  );
  days.set("2026-10-04", null); // a day without data is not counted against anyone
  const { items, daysWithData } = evergreen(days, range, rows);
  assert.equal(daysWithData, 9);
  assert.deepEqual(items.map((x) => x.group.lead.topic), ["คลิปเก่า #ถกไม่เถียง"]);
  const it = items[0];
  assert.equal(it.age, 70);
  assert.equal(it.band, "1-3m");
  assert.equal(it.daysGaining, 9);
  assert.equal(it.total, 9 * 80 + 4 * 40 + 5 * 60);
  assert.equal(it.trend, "up");
  assert.equal(it.topPlatform, "YouTube");
  assert.deepEqual(evergreenMix(items, "topicType"), [{ name: "ข่าวการเมือง", total: it.total, count: 1 }]);
});
