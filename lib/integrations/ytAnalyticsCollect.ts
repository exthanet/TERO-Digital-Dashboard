// YouTube Deep Dive data (Advanced → YouTube Deep Dive), collected by the daily
// sync through the CMS account for the channels in syncSecrets/youtube_cms:
//   ytAnalytics/meta                 when, which channel, how many parts
//   ytAnalytics/videos_###           lifetime numbers per video (views, engaged views,
//                                    watch time, subscribers, revenue, CPM, traffic sources)
//   ytAnalytics/channel              28 / 90-day traffic sources, search terms, revenue by content type
//   ytAnalytics/retention            retention curves of the most-watched videos
//   ytAnalytics/search               search terms per video for the most-searched videos
// Revenue is in USD as YouTube reports it. Firestore rules: admins read, nobody writes from a browser.
// Analysis only: any error here is reported and never fails the sync.
//
// Relative imports only: the sync runs this file directly with Node.
import { encodeFields, type Firestore } from "./firestoreRest.ts";
import { analyticsQuery, batchedQuery, type Report, type Wait } from "./youtubeAnalytics.ts";

export interface YtVideo {
  id: string;
  views: number;
  engagedViews: number;
  avgViewSec: number;
  avgViewPct: number;
  subs: number;
  shares: number;
  likes: number;
  comments: number;
  revenue: number;
  adRevenue: number;
  grossRevenue: number;
  cpm: number;
  playbackCpm: number;
  monetized: number;
  /** Lifetime views per traffic source (SHORTS, SUBSCRIBER, YT_SEARCH, …); top videos only. */
  traffic?: Record<string, number>;
}

export interface YtWindow {
  start: string;
  end: string;
  traffic: { source: string; views: number }[];
  searchTerms: { term: string; views: number }[];
  contentType: { type: string; views: number; revenue: number }[];
}

export interface YtAnalyticsData {
  channel: string;
  updatedAt: string;
  videos: YtVideo[];
  windows: { d28: YtWindow; d90: YtWindow };
  /** Per point: elapsed ratio, audienceWatchRatio, relativeRetentionPerformance (Firestore stores no nested arrays). */
  retention: { id: string; points: { at: number; watch: number; relative: number }[] }[];
  search: Record<string, { term: string; views: number }[]>;
}

/** How many videos get the per-video extras. */
export const TRAFFIC_TOP = 300;
export const RETENTION_TOP = 30;
export const SEARCH_TOP = 50;

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const rowsOf = (r: Report) => r.rows.map((row) => Object.fromEntries(r.cols.map((c, i) => [c, row[i]])) as Record<string, string | number>);
const n = (v: unknown) => Number(v) || 0;

/**
 * `since`: the earliest day any of `videoIds` was posted. Every number is
 * counted from then, which is each video's lifetime, and keeps the CMS
 * queries fast (from 2015 a single retention query took ~40 s).
 */
export async function collectYtAnalytics(
  token: string,
  ownerId: string,
  channel: string,
  videoIds: string[],
  today: string,
  since: string,
  wait?: Wait,
  fetcher?: typeof fetch,
): Promise<YtAnalyticsData> {
  const q = (params: Record<string, string>) => analyticsQuery(token, ownerId, params, wait, fetcher);
  const lifetime = { startDate: since, endDate: today };
  // Only real 11-character video ids: older rows stored "YT-…" ids; callers pass ids taken from URLs.
  const ids = [...new Set(videoIds)].filter((id) => /^[\w-]{11}$/.test(id));

  const core = rowsOf(await batchedQuery(ids, 200, (b) => q({ ...lifetime, metrics: "views,engagedViews,averageViewDuration,averageViewPercentage,subscribersGained,shares,likes,comments", dimensions: "video", filters: `video==${b.join(",")}`, maxResults: "200" })));
  const money = rowsOf(await batchedQuery(ids, 200, (b) => q({ ...lifetime, metrics: "estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm,monetizedPlaybacks", dimensions: "video", filters: `video==${b.join(",")}`, maxResults: "200" })));
  const moneyBy = new Map(money.map((m) => [String(m.video), m]));
  const videos: YtVideo[] = core.map((c) => {
    const m = moneyBy.get(String(c.video)) || {};
    return {
      id: String(c.video),
      views: n(c.views),
      engagedViews: n(c.engagedViews),
      avgViewSec: n(c.averageViewDuration),
      avgViewPct: n(c.averageViewPercentage),
      subs: n(c.subscribersGained),
      shares: n(c.shares),
      likes: n(c.likes),
      comments: n(c.comments),
      revenue: n(m.estimatedRevenue),
      adRevenue: n(m.estimatedAdRevenue),
      grossRevenue: n(m.grossRevenue),
      cpm: n(m.cpm),
      playbackCpm: n(m.playbackBasedCpm),
      monetized: n(m.monetizedPlaybacks),
    };
  });
  videos.sort((a, b) => b.views - a.views);

  // Traffic sources per video for the most-viewed ones (10 videos per request keeps rows under 200).
  const top = videos.slice(0, TRAFFIC_TOP).map((v) => v.id);
  const traffic = rowsOf(await batchedQuery(top, 10, (b) => q({ ...lifetime, metrics: "views", dimensions: "video,insightTrafficSourceType", filters: `video==${b.join(",")}`, maxResults: "200", sort: "-views" })));
  const byVideo = new Map(videos.map((v) => [v.id, v]));
  for (const t of traffic) {
    const v = byVideo.get(String(t.video));
    if (v) (v.traffic ||= {})[String(t.insightTrafficSourceType)] = n(t.views);
  }

  // Channel windows: complete days only (Analytics lags about two days).
  const end = addDays(today, -2);
  const window = async (days: number): Promise<YtWindow> => {
    const range = { startDate: addDays(end, -(days - 1)), endDate: end };
    const filters = `channel==${channel}`;
    const src = rowsOf(await q({ ...range, metrics: "views", dimensions: "insightTrafficSourceType", filters, sort: "-views" }));
    const terms = rowsOf(await q({ ...range, metrics: "views", dimensions: "insightTrafficSourceDetail", filters: `${filters};insightTrafficSourceType==YT_SEARCH`, sort: "-views", maxResults: "25" }));
    const types = rowsOf(await q({ ...range, metrics: "views,estimatedRevenue", dimensions: "creatorContentType", filters }));
    return {
      start: range.startDate,
      end: range.endDate,
      traffic: src.map((r) => ({ source: String(r.insightTrafficSourceType), views: n(r.views) })),
      searchTerms: terms.map((r) => ({ term: String(r.insightTrafficSourceDetail), views: n(r.views) })),
      contentType: types.map((r) => ({ type: String(r.creatorContentType), views: n(r.views), revenue: n(r.estimatedRevenue) })),
    };
  };
  const d28 = await window(28);
  const d90 = await window(90);

  // Retention curves of the most-viewed videos; one request each.
  const retention: YtAnalyticsData["retention"] = [];
  for (const v of videos.slice(0, RETENTION_TOP)) {
    const r = rowsOf(await q({ ...lifetime, metrics: "audienceWatchRatio,relativeRetentionPerformance", dimensions: "elapsedVideoTimeRatio", filters: `video==${v.id}` }));
    if (r.length) retention.push({ id: v.id, points: r.map((p) => ({ at: n(p.elapsedVideoTimeRatio), watch: Math.round(n(p.audienceWatchRatio) * 1000) / 1000, relative: Math.round(n(p.relativeRetentionPerformance) * 1000) / 1000 })) });
  }

  // Search terms of the videos found most through search.
  const searched = videos.filter((v) => (v.traffic?.YT_SEARCH || 0) > 0).sort((a, b) => (b.traffic!.YT_SEARCH || 0) - (a.traffic!.YT_SEARCH || 0)).slice(0, SEARCH_TOP);
  const search: YtAnalyticsData["search"] = {};
  for (const v of searched) {
    const r = rowsOf(await q({ ...lifetime, metrics: "views", dimensions: "insightTrafficSourceDetail", filters: `video==${v.id};insightTrafficSourceType==YT_SEARCH`, sort: "-views", maxResults: "10" }));
    search[v.id] = r.map((t) => ({ term: String(t.insightTrafficSourceDetail), views: n(t.views) }));
  }

  return { channel, updatedAt: new Date().toISOString(), videos, windows: { d28, d90 }, retention, search };
}

const PART = 400;

/** Replace ytAnalytics/* with `data` (old parts beyond the new count are deleted). */
export async function writeYtAnalytics(db: Firestore, data: YtAnalyticsData): Promise<number> {
  const parts = Math.max(1, Math.ceil(data.videos.length / PART));
  for (let i = 0; i < parts; i++) {
    await db.set(`ytAnalytics/videos_${String(i).padStart(3, "0")}`, encodeFields({ part: i, rows: data.videos.slice(i * PART, (i + 1) * PART) as unknown as Record<string, unknown>[] }));
  }
  const previous = (await db.listRaw("ytAnalytics")).map((d) => d.name.split("/").pop() || "").filter((id) => /^videos_\d{3}$/.test(id));
  for (const id of previous) if (Number(id.slice(7)) >= parts) await db.delete(`ytAnalytics/${id}`);
  await db.set("ytAnalytics/channel", encodeFields({ windows: data.windows as unknown as Record<string, unknown> }));
  await db.set("ytAnalytics/retention", encodeFields({ videos: data.retention as unknown as Record<string, unknown>[] }));
  await db.set("ytAnalytics/search", encodeFields({ videos: data.search as unknown as Record<string, unknown> }));
  await db.set("ytAnalytics/meta", encodeFields({ channel: data.channel, updatedAt: data.updatedAt, parts, videoCount: data.videos.length, currency: "USD" }));
  return parts;
}
