import assert from "node:assert/strict";
import test from "node:test";
import { extractHashtags, hashtagsField, parseHashtags } from "../lib/dashboard/hashtags.ts";
import { canFill, mergeIntoMaster } from "../lib/integrations/metricoolSync.ts";
import { hashtagStats } from "../lib/dashboard/platformReport.ts";

test("hashtags: Thai with marks, unique, lower case, no bare numbers", () => {
  assert.deepEqual(extractHashtags("เมื่อ “ยิ่งชีพ” ชม #ilaw #ยิ่งชีพ\nดูต่อ #ถกไม่เถียง #ILAW #2569 #ข่าวการเมือง_วันนี้"), ["#ilaw", "#ยิ่งชีพ", "#ถกไม่เถียง", "#ข่าวการเมือง_วันนี้"]);
  assert.equal(hashtagsField("ไม่มีแท็ก"), "");
  assert.deepEqual(parseHashtags("#a #b  #c"), ["#a", "#b", "#c"]);
});

test("fill rule: hashtags only when blank; time only over blank or the 00:00 placeholder", () => {
  assert.equal(canFill("Hashtags", "", "#a"), true);
  assert.equal(canFill("Hashtags", "#team", "#a"), false);
  assert.equal(canFill("Hashtags", "", ""), false);
  assert.equal(canFill("Publish_Time", "00:00", "18:04"), true);
  assert.equal(canFill("Publish_Time", "", "18:04"), true);
  assert.equal(canFill("Publish_Time", "17:30", "18:04"), false);
  assert.equal(canFill("Publish_Time", "", "00:00"), false);
});

test("merge fills empty columns on existing rows, keeps what the team set", () => {
  const master = [
    { Platform: "YouTube", URL: "https://www.youtube.com/watch?v=aaaaaaaaaaa", Views: "10", Publish_Time: "00:00", Hashtags: "" },
    { Platform: "YouTube", URL: "https://www.youtube.com/watch?v=bbbbbbbbbbb", Views: "10", Publish_Time: "09:15", Hashtags: "#ทีมใส่เอง" },
  ];
  const incoming = master.map((m) => ({ ...m, Views: "10", Publish_Time: "18:04", Hashtags: "#ใหม่" }));
  const r = mergeIntoMaster(master, incoming);
  assert.equal(r.merged[0].Publish_Time, "18:04");
  assert.equal(r.merged[0].Hashtags, "#ใหม่");
  assert.equal(r.merged[1].Publish_Time, "09:15");
  assert.equal(r.merged[1].Hashtags, "#ทีมใส่เอง");
  assert.equal(r.updated.length, 1);
});

test("hashtag report: tags with 3+ posts, median against the platform, share in the title", () => {
  const row = (views, hashtags, topic = "หัวข้อ") => ({ views, likes: 0, comments: 0, shares: 0, hashtags, topic });
  const rows = [row(100, "#a #b", "x #a"), row(200, "#a"), row(300, "#a #b"), row(1000, "#b"), row(50, "")];
  const s = hashtagStats(rows);
  assert.equal(s.withTags, 4);
  const a = s.tags.find((t) => t.tag === "#a");
  assert.equal(a.posts, 3);
  assert.equal(a.medianViews, 200);
  assert.equal(a.index, 200 / 200);
  assert.equal(a.inTitle, 1 / 3);
  assert.equal(s.tags.find((t) => t.tag === "#b").medianViews, 300);
});
