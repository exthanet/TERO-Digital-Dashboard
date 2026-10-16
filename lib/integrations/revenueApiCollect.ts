// YouTube Revenue for months the revenue file does not have yet: total, partner
// ads and Premium of the whole CMS through the YouTube Analytics API, written to
// revenueApi/{YYYY-MM} (rules: who may see revenue reads, nobody writes from a
// browser). The sync refreshes the running month and the one before, as YouTube
// keeps adjusting revenue after a month ends. Tested against the file for
// Jan–Sep 2026: total, ads and Premium matched to 0.0% (Aug within 2.6%).
// Analysis only: an error is reported and never fails the sync.
//
// Relative imports only: the sync runs this file directly with Node.
import { monthEnd } from "../dashboard/accMonthly.ts";
import type { RevenueApiMonth } from "../dashboard/revenueApi.ts";
import { encodeFields, type Firestore } from "./firestoreRest.ts";
import { analyticsQuery, type Wait } from "./youtubeAnalytics.ts";

export async function collectRevenueMonth(
  token: string,
  ownerId: string,
  month: string,
  today: string,
  wait?: Wait,
  fetcher?: typeof fetch,
): Promise<RevenueApiMonth> {
  const end = monthEnd(month);
  const endDate = end < today ? end : today;
  const q = (metrics: string) => analyticsQuery(token, ownerId, { startDate: `${month}-01`, endDate, metrics }, wait, fetcher);
  // Separate requests: asked together with other money metrics the CMS can answer "internal error".
  const total = await q("estimatedRevenue");
  const money = await q("estimatedAdRevenue,estimatedRedPartnerRevenue");
  return {
    month,
    endDate,
    complete: end < today,
    estRevenue: Number(total.rows[0]?.[0]) || 0,
    partnerAdRevenue: Number(money.rows[0]?.[0]) || 0,
    youtubePremiumRevenue: Number(money.rows[0]?.[1]) || 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function writeRevenueApiMonth(db: Firestore, m: RevenueApiMonth): Promise<void> {
  await db.set(`revenueApi/${m.month}`, encodeFields({ ...m, currency: "USD", source: "YouTube Analytics API (CMS)" } as unknown as Record<string, unknown>));
}
