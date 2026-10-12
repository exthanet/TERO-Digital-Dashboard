import assert from "node:assert/strict";
import test from "node:test";
import { csvLine, matchRow, monthLabels, parseCmsChannels, parseSourceTable, parseZipName } from "../lib/dashboard/revenueSources.ts";

test("zip names: period and channel; other files ignored", () => {
  assert.deepEqual(parseZipName("Revenue source 2026-09-01_2026-10-01 กระจกหกด้าน _ Krajokhokdan Official.zip"), {
    start: "2026-09-01",
    end: "2026-10-01",
    channel: "กระจกหกด้าน _ Krajokhokdan Official",
  });
  assert.equal(parseZipName("Channel 2026-07-01_2026-08-01 TERO DIGITAL CMS.zip"), null);
});

test("revenue source table and CMS channels", () => {
  assert.deepEqual(csvLine('"a, b",1.5'), ["a, b", "1.5"]);
  const t = parseSourceTable("﻿Revenue source,Estimated partner revenue (USD)\nTotal,12.5\nEstimated partner ad revenue,10\nYouTube Premium,2.5\n");
  assert.deepEqual(t, { Total: 12.5, "Estimated partner ad revenue": 10, "YouTube Premium": 2.5 });
  const cms = parseCmsChannels("Channel,Channel title,Views\nTotal,,9\nUCabcdefghij1234567890,Kids Fun คิดฝัน,5\nUCzzzzzzzzzz1234567890,กระจกหกด้าน | Krajokhokdan Official,1\n");
  assert.equal(cms.get("Kids Fun คิดฝัน"), "UCabcdefghij1234567890");
  assert.equal(cms.has("Total"), false);
});

test("rows matched by channel ID first, then a unique name; never guessed", () => {
  const rows = [
    { row: 56, name: "ครอบครัวข่าวเด็ก (Kids Fun)", id: "abcdefghij1234567890" },
    { row: 75, name: "Krajokhokdan (กระจกหกด้าน)", id: "zzzzzzzzzz1234567890" },
    { row: 74, name: "Bsitein", id: "pyL94ggjcjv-gqGKJAnSmA" },
  ];
  const cms = new Map([
    ["Kids Fun คิดฝัน", "UCabcdefghij1234567890"],
    ["กระจกหกด้าน | Krajokhokdan Official", "UCzzzzzzzzzz1234567890"],
  ]);
  assert.deepEqual(matchRow("Kids Fun คิดฝัน", rows, cms), { row: rows[0], by: "id" });
  assert.deepEqual(matchRow("กระจกหกด้าน _ Krajokhokdan Official", rows, cms), { row: rows[1], by: "id" });
  assert.deepEqual(matchRow("Bsitein", rows, cms), { row: rows[2], by: "name" });
  assert.equal(matchRow("Unknown channel", rows, cms), null);
});

test("a second download's (1) is not part of the name; month labels", () => {
  assert.equal(parseZipName("Revenue source 2026-08-01_2026-09-01 Kids Fun คิดฝัน (1).zip").channel, "Kids Fun คิดฝัน");
  assert.deepEqual(monthLabels("2026", "08"), { sheet: "Report_August_2026", header: "Aug 1-31, 2026" });
  assert.deepEqual(monthLabels("2026", "09"), { sheet: "Report_September_2026", header: "Sep 1-30, 2026" });
  assert.equal(monthLabels("2028", "02").header, "Feb 1-29, 2028");
});
