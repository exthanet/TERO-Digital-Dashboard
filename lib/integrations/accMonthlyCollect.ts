// รายได้ → Monthly ACC: monthly channel numbers through the CMS account,
// written to accMonthly/{YYYY-MM} (Firestore rules: admins read, nobody writes
// from a browser). The sync refreshes the running month and the one before,
// because YouTube keeps adjusting revenue for about two weeks after a month ends.
// Shows inside the TERO DIGITAL channel (ถกไม่เถียง, เงินทองของจริง) are
// counted from their own clips; the channel's line keeps the rest, so the three
// lines add up to the channel. Analysis only: any error is reported and never
// fails the sync.
//
// Relative imports only: the sync runs this file directly with Node.
import { ACC_CHANNELS, NUM_KEYS, accMinus, accTotals, monthEnd, type AccMonth, type AccNums, type AccRow } from "../dashboard/accMonthly.ts";
import { encodeFields, type Firestore } from "./firestoreRest.ts";
import { analyticsQuery, type Wait } from "./youtubeAnalytics.ts";

/** Video ids per request when a show is counted from its clips. */
const VIDEO_BATCH = 500;

/** Every upload of a channel (id and title), from its uploads playlist. */
export async function channelUploads(token: string, channelId: string, fetcher: typeof fetch = fetch): Promise<{ id: string; title: string }[]> {
  const get = async (u: string) => {
    const res = await fetcher(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
    const body = (await res.json()) as { error?: { message?: string }; nextPageToken?: string; items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } }; snippet?: { title?: string; resourceId?: { videoId?: string } } }[] };
    if (!res.ok) throw new Error(`YouTube Data API: ${body.error?.message || res.status}`);
    return body;
  };
  const ch = await get(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`);
  const playlist = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlist) throw new Error(`YouTube Data API: no uploads list for ${channelId}`);
  const out: { id: string; title: string }[] = [];
  let page = "";
  do {
    const r = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlist}${page ? `&pageToken=${page}` : ""}`);
    for (const it of r.items || []) {
      const id = it.snippet?.resourceId?.videoId;
      if (id) out.push({ id, title: it.snippet?.title || "" });
    }
    page = r.nextPageToken || "";
  } while (page);
  return out;
}

const ZERO = Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) as AccNums;

/**
 * One month for every line in ACC_CHANNELS. Month grouping is not supported for
 * these content-owner reports, so each month is its own date range. `today`
 * caps the running month. `programVideos`: the clip ids of each show line.
 */
export async function collectAccMonth(
  token: string,
  ownerId: string,
  month: string,
  today: string,
  programVideos: Record<string, string[]> = {},
  wait?: Wait,
  fetcher?: typeof fetch,
): Promise<AccMonth> {
  const startDate = `${month}-01`;
  const end = monthEnd(month);
  const endDate = end < today ? end : today;
  const q = (filters: string, params: Record<string, string>) => analyticsQuery(token, ownerId, { startDate, endDate, filters, ...params }, wait, fetcher);
  const by = (r: { rows: (string | number)[][] }, key: string) => r.rows.filter((x) => x[0] === key).reduce((a, x) => a + (Number(x[1]) || 0), 0);
  const numbers = async (filters: string): Promise<AccNums> => {
    // Views and revenue in separate requests: asked together the CMS answers "internal error".
    const views = await q(filters, { metrics: "views,redViews" });
    const money = await q(filters, { metrics: "estimatedAdRevenue,estimatedRedPartnerRevenue" });
    const place = await q(filters, { dimensions: "insightPlaybackLocationType", metrics: "views" });
    const live = await q(filters, { dimensions: "liveOrOnDemand", metrics: "views" });
    return {
      views: Number(views.rows[0]?.[0]) || 0,
      premiumViews: Number(views.rows[0]?.[1]) || 0,
      watchPage: by(place, "WATCH"),
      embedded: by(place, "EMBEDDED"),
      channelPage: by(place, "CHANNEL"),
      live: by(live, "LIVE"),
      onDemand: by(live, "ON_DEMAND"),
      adRevenue: Number(money.rows[0]?.[0]) || 0,
      premiumRevenue: Number(money.rows[0]?.[1]) || 0,
    };
  };
  const ofVideos = async (ids: string[]) => {
    const parts: AccNums[] = [];
    for (let i = 0; i < ids.length; i += VIDEO_BATCH) parts.push(await numbers(`video==${ids.slice(i, i + VIDEO_BATCH).join(",")}`));
    return parts.length ? accTotals(parts) : { ...ZERO };
  };

  const channelCache = new Map<string, AccNums>();
  const rows: AccRow[] = [];
  for (const ch of ACC_CHANNELS) {
    if (!ch.id) {
      rows.push({ name: ch.name, channelId: "", missing: true, ...ZERO });
      continue;
    }
    if (!channelCache.has(ch.id)) channelCache.set(ch.id, await numbers(`channel==${ch.id}`));
    const nums = ch.program ? await ofVideos(programVideos[ch.program] || []) : channelCache.get(ch.id)!;
    rows.push({ name: ch.name, channelId: ch.id, ...(ch.program ? { program: ch.program } : {}), ...nums });
  }
  // A channel with show lines keeps only what the shows don't cover.
  for (const r of rows) {
    if (r.program || r.missing) continue;
    const shows = rows.filter((x) => x.program && x.channelId === r.channelId);
    if (shows.length) Object.assign(r, accMinus(r, accTotals(shows)));
  }
  return { month, through: endDate, updatedAt: new Date().toISOString(), rows };
}

export async function writeAccMonth(db: Firestore, m: AccMonth): Promise<void> {
  await db.set(`accMonthly/${m.month}`, encodeFields({ ...m, currency: "USD", source: "YouTube Analytics API (CMS)" } as unknown as Record<string, unknown>));
}
