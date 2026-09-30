import assert from "node:assert/strict";
import test from "node:test";
import {
  YouTubeDataApi,
  combineYouTube,
  mapYouTubeVideo,
  parseIsoDuration,
  uploadsPlaylist,
} from "../lib/integrations/youtubeData.ts";
import { mapPost } from "../lib/integrations/metricoolSync.ts";

const TERO = { blogId: 6487104, label: "TERO Digital", mode: "multi", enabled: true, youtubeChannelId: "UCq2_AaNWBd0kxzR1HL2yhsw" };

test("durations and the uploads playlist id", () => {
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("PT44S"), 44);
  assert.equal(parseIsoDuration("P1DT1M"), 86460);
  assert.equal(parseIsoDuration(""), 0);
  assert.equal(uploadsPlaylist("UCq2_AaNWBd0kxzR1HL2yhsw"), "UUq2_AaNWBd0kxzR1HL2yhsw");
});

test("listUploads pages newest-first and stops at the since date", async () => {
  const pages = [
    { items: [
      { contentDetails: { videoId: "new1", videoPublishedAt: "2026-09-02T01:00:00Z" } },
      { contentDetails: { videoId: "private" } }, // no publish time: skipped
      { contentDetails: { videoId: "new2", videoPublishedAt: "2026-08-15T01:00:00Z" } },
    ], nextPageToken: "p2" },
    { items: [
      { contentDetails: { videoId: "new3", videoPublishedAt: "2026-08-01T00:30:00Z" } },
      { contentDetails: { videoId: "old", videoPublishedAt: "2026-07-20T00:00:00Z" } },
    ], nextPageToken: "p3" },
    { items: [{ contentDetails: { videoId: "never-requested", videoPublishedAt: "2026-07-01T00:00:00Z" } }] },
  ];
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => pages[calls.length - 1] };
  };
  try {
    const ids = await new YouTubeDataApi("test-key").listUploads("UCq2_AaNWBd0kxzR1HL2yhsw", "2026-07-31T17:00:00Z");
    assert.deepEqual(ids, ["new1", "new2", "new3"]);
    assert.equal(calls.length, 2, "stops after the page that reaches older videos");
    assert.match(calls[0], /playlistId=UUq2_AaNWBd0kxzR1HL2yhsw/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Data API videos map to master rows with the team's format labels", () => {
  const base = { title: "ฮั้ว สว. #ถกไม่เถียง", description: "", publishedAt: "2026-08-03T11:00:00Z", views: 1352, likes: 40, comments: 5, live: false };
  const ep = mapYouTubeVideo({ ...base, id: "_ILZtzNFUvc", durationSec: 2400 }, TERO);
  assert.equal(ep.VDO_Type, "Video Episode");
  assert.equal(ep.Program, "ถกไม่เถียง");
  assert.equal(ep.Date, "03/08/2026");
  assert.equal(ep.Publish_Time, "18:00");
  assert.equal(ep.URL, "https://www.youtube.com/watch?v=_ILZtzNFUvc");
  assert.equal(mapYouTubeVideo({ ...base, id: "short0000001", durationSec: 58 }, TERO).VDO_Type, "Shorts");
  assert.equal(mapYouTubeVideo({ ...base, id: "live00000001", durationSec: 7000, live: true }, TERO).VDO_Type, "LIVE");
});

test("combining sources: Data API counts win, Metricool keeps shares, gaps are filled", () => {
  const fromMetricool = mapPost("youtube", {
    videoId: "zu18DUg143A", title: "#ถกไม่เถียง", publishedAt: { dateTime: "2026-08-10T10:00:00", timezone: "Europe/Madrid" },
    views: 500000, likes: 10, comments: 1, shares: 7, videoType: "SHORT",
  }, TERO);
  const fromApi = [
    mapYouTubeVideo({ id: "zu18DUg143A", title: "#ถกไม่เถียง", description: "", publishedAt: "2026-08-10T08:00:00Z", durationSec: 40, views: 1553329, likes: 20, comments: 3, live: false }, TERO),
    mapYouTubeVideo({ id: "_ILZtzNFUvc", title: "#ถกไม่เถียง", description: "", publishedAt: "2026-08-03T11:00:00Z", durationSec: 2400, views: 1352, likes: 40, comments: 5, live: false }, TERO),
  ];
  const { rows, onlyDataApi } = combineYouTube([fromMetricool], fromApi);
  assert.equal(onlyDataApi, 1);
  assert.equal(rows.length, 2);
  const merged = rows.find((r) => r.Content_ID === "zu18DUg143A");
  assert.equal(merged.Views, "1553329");
  assert.equal(merged.Shares, "7");
  assert.equal(merged.Engagement, "30"); // 20 likes + 3 comments + 7 shares
  assert.equal(merged.VDO_Type, "Shorts"); // Metricool's SHORT flag kept
});
