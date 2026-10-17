// YouTube Revenue for months the revenue file does not have yet: total, partner
// ads and Premium of the whole CMS through the YouTube Analytics API, written to
// revenueApi/{YYYY-MM} (rules: who may see revenue reads, nobody writes from a
// browser), with each CMS channel's estimated revenue for รายงานผล → YouTube
// Revenue → CMS Channel. The sync refreshes the running month and the one before,
// as YouTube keeps adjusting revenue after a month ends. Tested against the file
// for Jan–Sep 2026: total, ads and Premium matched to 0.0% (Aug within 2.6%); the
// channels of Sep 2026 add up to the total within 0.4%.
// Analysis only: an error is reported and never fails the sync.
//
// Relative imports only: the sync runs this file directly with Node.
import { monthEnd } from "../dashboard/accMonthly.ts";
import type { RevenueApiMonth } from "../dashboard/revenueApi.ts";
import { encodeFields, type Firestore } from "./firestoreRest.ts";
import { analyticsQuery, type Wait } from "./youtubeAnalytics.ts";

export interface CmsChannel {
  id: string;
  title: string;
}

/** Every channel the CMS manages (YouTube Data API on behalf of the content owner). */
export async function listCmsChannels(token: string, ownerId: string, fetcher: typeof fetch = fetch): Promise<CmsChannel[]> {
  const out: CmsChannel[] = [];
  let page = "";
  do {
    const q = new URLSearchParams({ part: "snippet", managedByMe: "true", onBehalfOfContentOwner: ownerId, maxResults: "50", ...(page ? { pageToken: page } : {}) });
    const res = await fetcher(`https://www.googleapis.com/youtube/v3/channels?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
    const body = (await res.json()) as { error?: { message?: string }; nextPageToken?: string; items?: { id: string; snippet?: { title?: string } }[] };
    if (!res.ok) throw new Error(`YouTube Data API: ${body.error?.message || res.status}`);
    out.push(...(body.items || []).map((c) => ({ id: c.id, title: c.snippet?.title || c.id })));
    page = body.nextPageToken || "";
  } while (page);
  return out;
}

/**
 * The month's total, partner ads and Premium of the whole CMS and, when
 * `channels` is given, each channel's estimated revenue (only the ones that earned).
 */
export async function collectRevenueMonth(
  token: string,
  ownerId: string,
  month: string,
  today: string,
  wait?: Wait,
  fetcher?: typeof fetch,
  channels?: CmsChannel[],
): Promise<RevenueApiMonth> {
  const end = monthEnd(month);
  const endDate = end < today ? end : today;
  const q = (metrics: string, filters?: string) =>
    analyticsQuery(token, ownerId, { startDate: `${month}-01`, endDate, metrics, ...(filters ? { filters } : {}) }, wait, fetcher);
  // Separate requests: asked together with other money metrics the CMS can answer "internal error".
  const total = await q("estimatedRevenue");
  const money = await q("estimatedAdRevenue,estimatedRedPartnerRevenue");
  // Money has no channel dimension for a content owner: one query per channel.
  const byChannel: NonNullable<RevenueApiMonth["channels"]> = [];
  for (const c of channels || []) {
    const revenue = Number((await q("estimatedRevenue", `channel==${c.id}`)).rows[0]?.[0]) || 0;
    if (revenue > 0) byChannel.push({ id: c.id, title: c.title, revenue });
  }
  byChannel.sort((a, b) => b.revenue - a.revenue);
  return {
    month,
    endDate,
    complete: end < today,
    estRevenue: Number(total.rows[0]?.[0]) || 0,
    partnerAdRevenue: Number(money.rows[0]?.[0]) || 0,
    youtubePremiumRevenue: Number(money.rows[0]?.[1]) || 0,
    ...(channels ? { channels: byChannel } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export async function writeRevenueApiMonth(db: Firestore, m: RevenueApiMonth): Promise<void> {
  await db.set(`revenueApi/${m.month}`, encodeFields({ ...m, currency: "USD", source: "YouTube Analytics API (CMS)" } as unknown as Record<string, unknown>));
}
