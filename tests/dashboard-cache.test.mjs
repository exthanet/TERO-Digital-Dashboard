import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { joinBytes, partId, slimRows, splitBytes } from "../lib/dashboard/cacheFormat.ts";
import { normalizeRowsWithDeduplication } from "../lib/dashboard/normalize.ts";

const digital = {
  Date: "2026-09-21", Program: "ถกไม่เถียง", Topic: "คลิป", Topic_Type: "ข่าวการเมือง", VDO_Type: "Shorts", Platform: "YouTube",
  Channel: "TERO Digital", Content_ID: "abcdefghijk", URL: "https://www.youtube.com/watch?v=abcdefghijk", Duration_Min: "0.75",
  Views: "1200", Likes: "30", Comments: "4", Shares: "1", Engagement: "35", Engagement_Rate: "2.92%",
  Notes: "a long import note that the dashboard never reads", Publish_Time: "18:05", Video_Views: "", TV_Rating_Total: "", Revenue: "",
};
const tv = {
  Date: "2026-09-21", Program: "ถกไม่เถียง", Topic: "เทป", Platform: "TV", Channel: "One31", Content_ID: "TV-One31-2026-09-21",
  TV_Rating_Total: 0.25, "TV_Rating_15+BKK": 0.3, "TV_Audience_15+BKK": 210000, TV_Audience_Total: 117763, Notes: "GMM Rating: 0.2",
};

test("digital rows keep only what the dashboard reads; TV rows stay whole", () => {
  const [d, t] = slimRows([digital, tv]);
  assert.equal(d.Notes, undefined);
  assert.equal(d.Publish_Time, undefined);
  assert.equal(d.Video_Views, undefined); // blank values dropped
  assert.equal(d.Views, "1200");
  assert.equal(d.URL, digital.URL);
  assert.deepEqual(t, tv);
});

test("the compact copy normalises exactly like the full rows", () => {
  const rows = [digital, tv, { ...digital, Content_ID: "zzzzzzzzzzz", URL: "", Views: "5" }];
  const back = JSON.parse(gunzipSync(joinBytes(splitBytes(gzipSync(JSON.stringify(slimRows(rows))), 50))).toString("utf8"));
  assert.deepEqual(normalizeRowsWithDeduplication(back), normalizeRowsWithDeduplication(rows));
});

test("bytes split into document-sized parts and join back", () => {
  const bytes = new Uint8Array(2500).map((_, i) => i % 251);
  const parts = splitBytes(bytes, 1000);
  assert.deepEqual(parts.map((p) => p.length), [1000, 1000, 500]);
  assert.deepEqual(joinBytes(parts), bytes);
  assert.equal(splitBytes(new Uint8Array(0)).length, 1);
  assert.equal(partId(3), "part_03");
});
