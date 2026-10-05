// YouTube Analytics through the content owner (CMS) account: lifetime watch
// time and shares per video for the channels named in syncSecrets/youtube_cms.
// The refresh token lives only there (Firestore rules: no client reads it);
// the OAuth client id/secret come from the environment (GitHub Secrets).
//
// Numbers are written as the API gives them (API values win); a failure here
// never fails the sync — the rows keep what Metricool / the Data API gave.
//
// Relative imports only: the sync runs this file directly with Node.
import { decodeFields, encodeFields, type Firestore } from "./firestoreRest.ts";
import { formatPercent, formatWhole } from "./metricool.ts";
import type { MappedRow } from "./metricoolSync.ts";

export const CMS_DOC = "syncSecrets/youtube_cms";

export interface CmsAccount {
  ownerId: string;
  refreshToken: string;
  /** Channel ids whose videos the sync enriches. */
  channels: string[];
  updatedAt?: string;
}

export interface VideoStats {
  views: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  subscribersGained: number;
  shares: number;
}

/** What an admin should do about an Analytics error, in Thai. */
export function analyticsProblem(error: string): string {
  if (/invalid_grant|revoked|expired/i.test(error)) return "ต้องล็อกอินใหม่: สิทธิ์ถูกยกเลิกหรือหมดอายุ (scripts/youtube-analytics-auth.mjs login --cms=…)";
  if (/forbidden|permission|insufficient|403/i.test(error)) return "บัญชีที่อนุญาตไม่มีสิทธิ์ใน CMS แล้ว: ให้ admin CMS ตรวจสิทธิ์ หรือล็อกอินใหม่ด้วยบัญชีที่มีสิทธิ์";
  if (/YT_OAUTH_CLIENT/i.test(error)) return "ยังไม่ได้ใส่ YT_OAUTH_CLIENT_ID / YT_OAUTH_CLIENT_SECRET ใน GitHub Secrets";
  if (/quota/i.test(error)) return "เกินโควตา YouTube Analytics วันนี้ จะลองใหม่รอบถัดไป";
  if (/internal error|backend error|5\d\d/i.test(error)) return "YouTube Analytics ขัดข้องชั่วคราว (ลองซ้ำแล้วยังไม่ได้) จะลองใหม่รอบถัดไป";
  return error.slice(0, 200);
}

export async function loadCmsAccount(db: Firestore): Promise<CmsAccount | null> {
  const doc = await db.get(CMS_DOC);
  if (!doc) return null;
  const x = decodeFields(doc.fields || {}) as Partial<CmsAccount>;
  return x.ownerId && x.refreshToken ? { ownerId: x.ownerId, refreshToken: x.refreshToken, channels: x.channels || [], updatedAt: x.updatedAt } : null;
}

export async function saveCmsAccount(db: Firestore, account: CmsAccount): Promise<void> {
  await db.set(CMS_DOC, encodeFields({ ...account, updatedAt: new Date().toISOString() }));
}

export async function accessTokenFor(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google token: ${body.error || res.status} ${body.error_description || ""}`.trim());
  return body.access_token;
}

const METRICS = ["views", "averageViewDuration", "averageViewPercentage", "subscribersGained", "shares"] as const;

/**
 * Lifetime numbers per video (200 ids per request) through the content owner.
 * `endDate` is today: Analytics lags a day or two, so the last days may still grow.
 */
export async function videoStats(
  accessToken: string,
  ownerId: string,
  ids: string[],
  endDate: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  fetcher: typeof fetch = fetch,
): Promise<Map<string, VideoStats>> {
  const out = new Map<string, VideoStats>();
  type Body = { rows?: (string | number)[][]; columnHeaders?: { name: string }[]; error?: { message?: string } };
  const query = async (batch: string[]): Promise<Body> => {
    const q = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    q.search = new URLSearchParams({
      ids: `contentOwner==${ownerId}`,
      startDate: "2015-01-01",
      endDate,
      metrics: METRICS.join(","),
      dimensions: "video",
      filters: `video==${batch.join(",")}`,
      maxResults: "200",
    }).toString();
    // Google's "internal error" / 5xx / network hiccups pass on a retry; anything else is real.
    for (let attempt = 1; ; attempt++) {
      let res: Response | null = null;
      let body: Body = {};
      try {
        res = await fetcher(q, { headers: { Authorization: `Bearer ${accessToken}` } });
        body = (await res.json()) as Body;
      } catch (e) {
        if (attempt >= 4) throw new Error(`YouTube Analytics: ${e instanceof Error ? e.message : String(e)}`);
        await wait(5000 * attempt);
        continue;
      }
      if (res.ok) return body;
      const transient = res.status >= 500 || /internal error|backend error/i.test(body.error?.message || "");
      if (!transient || attempt >= 4) {
        const err = new Error(`YouTube Analytics: ${body.error?.message || res.status}`) as Error & { transient?: boolean };
        err.transient = transient;
        throw err;
      }
      await wait(5000 * attempt);
    }
  };
  // 200 videos per request; a batch that keeps failing with an internal error is split in four.
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
  while (batches.length) {
    const batch = batches.shift()!;
    let body: Body;
    try {
      body = await query(batch);
    } catch (e) {
      if ((e as { transient?: boolean }).transient && batch.length > 50) {
        const size = Math.ceil(batch.length / 4);
        const parts: string[][] = [];
        for (let i = 0; i < batch.length; i += size) parts.push(batch.slice(i, i + size));
        batches.unshift(...parts);
        continue;
      }
      throw e;
    }
    const cols = (body.columnHeaders || []).map((h) => h.name);
    for (const row of body.rows || []) {
      const get = (name: string) => Number(row[cols.indexOf(name)]) || 0;
      out.set(String(row[cols.indexOf("video")]), {
        views: get("views"),
        averageViewDuration: get("averageViewDuration"),
        averageViewPercentage: get("averageViewPercentage"),
        subscribersGained: get("subscribersGained"),
        shares: get("shares"),
      });
    }
  }
  return out;
}

/**
 * Watch time and shares from Analytics onto the YouTube rows it has; engagement
 * and its rate follow. Views stay as the Data API gave them (live, not lagged).
 * Returns how many rows changed.
 */
export function applyVideoStats(rows: MappedRow[], stats: Map<string, VideoStats>): number {
  let changed = 0;
  for (const r of rows) {
    if (r.Platform !== "YouTube") continue;
    const s = stats.get(String(r.Content_ID));
    if (!s) continue;
    const num = (v: unknown) => Number(String(v ?? "").replace(/,/g, "")) || 0;
    const views = num(r.Views);
    const engagement = num(r.Likes) + num(r.Comments) + s.shares;
    Object.assign(r, {
      Avg_Watch_Sec: String(Math.round(s.averageViewDuration)),
      Shares: formatWhole(s.shares),
      Engagement: formatWhole(engagement),
      Engagement_Rate: formatPercent(views > 0 ? (engagement / views) * 100 : 0),
    });
    changed++;
  }
  return changed;
}
