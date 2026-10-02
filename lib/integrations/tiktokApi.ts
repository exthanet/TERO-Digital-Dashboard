// TikTok Display API (Login Kit; scopes user.info.basic + video.list) for the
// daily sync. Each authorised account's refresh token lives in Firestore
// syncSecrets/tiktok_{n} (firestore.rules: no client can read it); the app's
// client key / secret come from the environment (GitHub Secrets / .env.local).
//
// Videos are turned into the same post shape Metricool sends and mapped with
// mapPost("tiktok", …), so both sources produce identical rows and keys.
// Relative imports only: scripts run this file directly with Node.
import { mapPost, rowKey, type BrandConfig, type MappedRow } from "./metricoolSync.ts";
import { decodeFields, docId, encodeFields, type Firestore } from "./firestoreRest.ts";

export interface TikTokVideo {
  id: string;
  create_time: number;
  title?: string;
  video_description?: string;
  duration?: number;
  share_url?: string;
  cover_image_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export interface TikTokAccount {
  /** Firestore document id under syncSecrets/. */
  id: string;
  /** Metricool brand label this account replaces for TikTok (config/metricool-brands.json). */
  brand: string;
  openId: string;
  displayName: string;
  refreshToken: string;
  refreshExpiresAt: string;
  /** False until the first API run: that run sets the starting point and files no growth. */
  baselineDone: boolean;
  updateTime?: string;
}

const FIELDS = "id,create_time,title,video_description,duration,share_url,cover_image_url,view_count,like_count,comment_count,share_count";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- tokens ----------

export async function refreshAccessToken(clientKey: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !body.access_token) throw new Error(`token refresh: ${body.error || res.status} ${body.error_description || ""}`.trim());
  return {
    accessToken: String(body.access_token),
    refreshToken: String(body.refresh_token || refreshToken),
    refreshExpiresAt: new Date(Date.now() + Number(body.refresh_expires_in || 0) * 1000).toISOString(),
    openId: String(body.open_id || ""),
  };
}

export async function loadAccounts(db: Firestore): Promise<TikTokAccount[]> {
  return (await db.listRaw("syncSecrets"))
    .filter((d) => docId(d.name).startsWith("tiktok_"))
    .map((d) => {
      const f = decodeFields(d.fields || {});
      return {
        id: docId(d.name),
        brand: String(f.brand || ""),
        openId: String(f.openId || ""),
        displayName: String(f.displayName || ""),
        refreshToken: String(f.refreshToken || ""),
        refreshExpiresAt: String(f.refreshExpiresAt || ""),
        baselineDone: f.baselineDone === true,
        updateTime: d.updateTime,
      };
    })
    .filter((a) => a.brand && a.refreshToken);
}

/** Save account fields; refuses if someone changed the document meanwhile. */
export async function saveAccount(db: Firestore, a: TikTokAccount): Promise<void> {
  const { id, updateTime, ...fields } = a;
  const written = await db.set(`syncSecrets/${id}`, encodeFields({ ...fields, updatedAt: new Date().toISOString() }), updateTime ? { updateTime } : {});
  a.updateTime = written.updateTime;
}

// ---------- videos ----------

/** Every video posted since `sinceSec` (newest first, 20 per page), waiting out rate limits. */
export async function listVideos(
  accessToken: string,
  sinceSec: number,
  log: (s: string) => void = () => undefined,
  wait: (ms: number) => Promise<unknown> = sleep,
): Promise<TikTokVideo[]> {
  const videos: TikTokVideo[] = [];
  let cursor: number | undefined;
  for (let page = 1; page <= 500; page++) {
    let body: { data?: { videos?: TikTokVideo[]; has_more?: boolean; cursor?: number }; error?: { code?: string; message?: string } } = {};
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${FIELDS}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
      });
      body = await res.json();
      if (body.error?.code === "rate_limit_exceeded" && attempt <= 6) {
        log(`    TikTok rate limit on page ${page}, waiting ${15 * attempt}s`);
        await wait(15_000 * attempt);
        continue;
      }
      if (!res.ok || body.error?.code !== "ok") throw new Error(`video/list page ${page}: ${body.error?.code || res.status} ${body.error?.message || ""}`.trim());
      break;
    }
    const batch = body.data?.videos || [];
    videos.push(...batch.filter((v) => v.create_time >= sinceSec));
    if (!body.data?.has_more || batch.some((v) => v.create_time < sinceSec)) break;
    cursor = body.data.cursor;
    await wait(1000);
  }
  return videos;
}

/** API video → the post shape Metricool sends for TikTok, mapped by the same mapPost. */
export function mapTikTokVideo(v: TikTokVideo, brand: BrandConfig): MappedRow | null {
  return mapPost(
    "tiktok",
    {
      videoId: v.id,
      shareUrl: v.share_url || "",
      videoDescription: v.video_description || "",
      title: v.title || "",
      createTime: new Date(v.create_time * 1000).toISOString(),
      viewCount: v.view_count ?? 0,
      likeCount: v.like_count ?? 0,
      commentCount: v.comment_count ?? 0,
      shareCount: v.share_count ?? 0,
      duration: v.duration ?? 0,
    },
    brand,
  );
}

// ---------- choosing the source ----------

export interface TikTokCompare {
  apiVideos: number;
  metricoolPosts: number;
  matched: number;
  /** Median of (API views − Metricool views) ÷ Metricool views over matched posts. */
  medianViewDiff: number | null;
  onlyApi: number;
  onlyMetricool: number;
}

export function compareSources(api: MappedRow[], metricool: MappedRow[]): TikTokCompare {
  const mc = new Map(metricool.map((r) => [rowKey(r), r]));
  const diffs: number[] = [];
  let matched = 0;
  for (const r of api) {
    const m = mc.get(rowKey(r));
    if (!m) continue;
    matched++;
    const a = Number(String(r.Views).replace(/,/g, ""));
    const b = Number(String(m.Views).replace(/,/g, ""));
    if (b > 0) diffs.push((a - b) / b);
  }
  diffs.sort((a, b) => a - b);
  return {
    apiVideos: api.length,
    metricoolPosts: metricool.length,
    matched,
    medianViewDiff: diffs.length ? diffs[Math.floor(diffs.length / 2)] : null,
    onlyApi: api.length - matched,
    onlyMetricool: metricool.length - matched,
  };
}

/**
 * The API is used only when it covers the account: at least 80% as many posts
 * as Metricool in the same window (a lost permission returns far fewer).
 */
export function apiCoversAccount(c: TikTokCompare): boolean {
  return c.apiVideos > 0 && c.apiVideos >= c.metricoolPosts * 0.8;
}
