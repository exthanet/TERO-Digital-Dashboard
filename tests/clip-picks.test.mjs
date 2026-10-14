import assert from "node:assert/strict";
import test from "node:test";
import { commonTopic, pickReasons } from "../lib/dashboard/clipPicks.ts";

const base = { platform: "TikTok", vdoType: "TikTok", erMedian: 0.03 };

test("best clip: against normal, platforms, ER, posting hour", () => {
  const r = pickReasons({
    ...base,
    kind: "best",
    index: 3.14,
    baseline: 12000,
    platforms: [
      { platform: "TikTok", views: 600 },
      { platform: "Facebook", views: 400 },
    ],
    er: 0.061,
    hour: 19,
    bestHour: 19,
  });
  assert.deepEqual(r, [
    "วิวสูงกว่าปกติ 3.1 เท่า (ปกติ ≈ 12.0K)",
    "ลง 2 แพลตฟอร์ม · TikTok ทำวิวมากสุด 60%",
    "ER 6.1% สูงกว่าค่ากลางของเดือน (3.0%)",
    "โพสต์ 19:00 ตรงช่วงที่ดีที่สุดของ TikTok",
  ]);
});

test("worst clip: share of normal, one platform, lower ER, another best hour", () => {
  const r = pickReasons({ ...base, kind: "worst", index: 0.18, baseline: 2500, platforms: [{ platform: "TikTok", views: 450 }], er: 0.01, hour: 3, bestHour: 20 });
  assert.deepEqual(r, [
    "ได้ 18% ของปกติ (ปกติ ≈ 2.5K)",
    "ลงแพลตฟอร์มเดียว (TikTok)",
    "ER 1.0% ต่ำกว่าค่ากลางของเดือน (3.0%)",
    "โพสต์ 03:00 · ช่วงที่ดีที่สุดของ TikTok คือ 20:00",
  ]);
  assert.deepEqual(pickReasons({ ...base, kind: "worst", index: null, baseline: null, platforms: [], er: 0, erMedian: null, hour: null, bestHour: null }), ["ไม่มีเวลาโพสต์ในข้อมูล"]);
});

test("the format alone when it names the platform", () => {
  const r = pickReasons({ ...base, platform: "Facebook", vdoType: "Facebook/IG Reels", kind: "best", index: null, baseline: null, platforms: [], er: 0, erMedian: null, hour: 18, bestHour: 16 });
  assert.deepEqual(r, ["โพสต์ 18:00 · ช่วงที่ดีที่สุดของ Facebook/IG Reels คือ 16:00"]);
  assert.equal(pickReasons({ ...base, platform: "YouTube", vdoType: "Shorts", kind: "best", index: null, baseline: null, platforms: [], er: 0, erMedian: null, hour: 9, bestHour: 9 })[0], "โพสต์ 09:00 ตรงช่วงที่ดีที่สุดของ YouTube Shorts");
});

test("a topic type shared by at least 3 of 5", () => {
  assert.equal(commonTopic(["ข่าวการเมือง", "ข่าวการเมือง", "ข่าวกระแส", "ข่าวการเมือง", ""]), "ข่าวการเมือง");
  assert.equal(commonTopic(["a", "b", "a", "c", "d"]), null);
});
