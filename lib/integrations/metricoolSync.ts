// Multi-brand Metricool sync: fetch posts per brand and network, convert them
// to master-data rows, and merge them without touching the team's columns.
//
// Findings from the live API (2026-09-30) this relies on:
// - `from`/`to` must be yyyy-MM-ddTHH:mm:ss (plain dates are rejected).
// - Dates come back in the account timezone (Europe/Madrid), not Bangkok.
// - YouTube lists the whole channel regardless of the range, and its views are
//   counted inside the range only; ask from the publish window start to today
//   for lifetime views.
// - Other networks filter by publish date and report lifetime numbers.
//
// Relative imports only: scripts run this file directly with Node.
import {
  firstLine,
  formatPercent,
  formatWhole,
  inferTopicType,
  parseNumber,
  type MasterRowOutput,
} from "./metricool.ts";
import { postId, rowKey } from "../dashboard/postKey.ts";

export type Network = "facebook" | "fbreels" | "instagram" | "reels" | "tiktok" | "youtube";
export const NETWORKS: Network[] = ["facebook", "fbreels", "instagram", "reels", "tiktok", "youtube"];

const ENDPOINTS: Record<Network, string> = {
  facebook: "v2/analytics/posts/facebook",
  // Reels are not in the posts feed (their links are /reel/, posts are /posts/).
  fbreels: "v2/analytics/reels/facebook",
  instagram: "v2/analytics/posts/instagram",
  reels: "v2/analytics/reels/instagram",
  tiktok: "v2/analytics/posts/tiktok",
  youtube: "v2/analytics/posts/youtube",
};

export interface BrandConfig {
  blogId: number;
  label: string;
  /** "single": every post belongs to `program`; "multi": detect it from the text. */
  mode: "single" | "multi";
  program?: string;
  enabled: boolean;
  /** Also read this channel through the YouTube Data API (fills Metricool gaps). */
  youtubeChannelId?: string;
}

export interface Brand {
  id: number;
  label: string;
  networks: string[];
}

export type Post = Record<string, unknown>;

export class MetricoolApi {
  private userId: string;
  private token: string;
  private baseUrl: string;

  constructor(config: { userId: string; apiToken: string; baseUrl?: string }) {
    this.userId = config.userId;
    this.token = config.apiToken;
    this.baseUrl = (config.baseUrl || "https://app.metricool.com/api").replace(/\/$/, "");
    if (!this.userId || !this.token) throw new Error("METRICOOL_USER_ID and METRICOOL_API_TOKEN are required");
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/${path}`);
    url.searchParams.set("userId", this.userId);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { headers: { "X-Mc-Auth": this.token, Accept: "application/json" } });
      if (res.ok) return res.json();
      // Retry rate limits and server hiccups a few times with backoff.
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      const body = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Metricool ${res.status} on ${path}: ${body}`);
    }
  }

  async listBrands(): Promise<Brand[]> {
    const data = (await this.get("admin/simpleProfiles", {})) as Post[];
    const nets = ["facebook", "instagram", "tiktok", "youtube", "twitter", "threads", "linkedinCompany"];
    return data.map((b) => ({
      id: Number(b.id),
      label: String(b.label ?? b.title ?? b.id),
      networks: nets.filter((n) => b[n]),
    }));
  }

  /** Posts published between `from` and `to` (YYYY-MM-DD, Bangkok days). */
  async fetchPosts(network: Network, blogId: number, from: string, to: string): Promise<Post[]> {
    const data = await this.get(ENDPOINTS[network], {
      blogId: String(blogId),
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      timezone: "Asia/Bangkok",
    });
    const list = Array.isArray(data) ? data : ((data as { data?: Post[] })?.data ?? []);
    return list as Post[];
  }
}

// ---------- time ----------

function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** Wall-clock time in `timeZone` → UTC milliseconds (DST-safe). */
export function zonedToUtc(local: string, timeZone: string): number {
  const guess = Date.parse(`${local.slice(0, 19)}Z`);
  let utc = guess - tzOffsetMinutes(guess, timeZone) * 60000;
  const again = guess - tzOffsetMinutes(utc, timeZone) * 60000;
  if (again !== utc) utc = again;
  return utc;
}

/** Any Metricool date shape → UTC ms, or NaN. */
export function postTimeUtc(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "dateTime" in value) {
    const v = value as { dateTime: string; timezone?: string };
    return zonedToUtc(v.dateTime, v.timezone || "UTC");
  }
  const text = String(value ?? "");
  // "2026-09-26T11:58:58+0200" → make the offset ISO-parsable (+02:00).
  const iso = text.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return Date.parse(iso);
}

const BANGKOK_MS = 7 * 3600000;

/** UTC ms → Bangkok { iso: YYYY-MM-DD, date: DD/MM/YYYY, time: HH:mm }. */
export function bangkokParts(utcMs: number) {
  const s = new Date(utcMs + BANGKOK_MS).toISOString();
  const iso = s.slice(0, 10);
  return { iso, date: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, time: s.slice(11, 16) };
}

// ---------- identity ----------

// Post keys live in lib/dashboard/postKey.ts so the dashboard matches posts the same way.
export { postId, rowKey } from "../dashboard/postKey.ts";

// ---------- program / format detection ----------

/** Program from post text. More specific names are checked first. */
export function detectProgram(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (t.includes("ถกไม่เถียง") || /ทิน\s*โชคกมลกิจ/.test(t)) return "ถกไม่เถียง";
  if (t.includes("kids fun") || t.includes("kidsfun") || t.includes("คิดฝัน")) return "Kidsfun";
  if (t.includes("hitz") || t.includes("ฮิตซ์")) return "Hitzradio";
  return "ไม่ระบุ";
}

const isLive = (text: string) => /\[\s*live\s*\]|🔴|\blive\b|ไลฟ์สด/i.test(text);

function vdoType(network: Network, post: Post, text: string): string {
  switch (network) {
    case "youtube": {
      if (String(post.videoType).toUpperCase() === "SHORT") return "Shorts";
      return isLive(text) ? "LIVE" : "Video Episode";
    }
    // The team labels everything from the posts feed "Facebook Post", videos included.
    case "facebook":
      return "Facebook Post";
    case "fbreels":
      return "Facebook Reels";
    case "reels":
      return "Instagram Reels";
    case "instagram":
      return "Instagram Post";
    case "tiktok":
      return "TikTok";
  }
}

// ---------- mapping ----------

export interface MappedRow extends MasterRowOutput {
  /** Facebook posts only: people who watched the video (3-second views). "" elsewhere. */
  Video_Views: string;
  /**
   * Watch time, as the API reports it (seconds). "" where the API has none:
   * TikTok, Instagram feed posts, Facebook posts (their unit is unclear).
   * YouTube: average view duration; Facebook Reels: average time watched;
   * Instagram Reels: average watch time.
   */
  Avg_Watch_Sec: string;
  /** Video length from the same API, in seconds, beside Avg_Watch_Sec. */
  Video_Length_Sec: string;
  /** Instagram Reels only: % of plays skipped in the first seconds. */
  Skip_Rate: string;
  /** Facebook posts only, as Metricool reports them: clicks on the post, link clicks, impressions (for CTR). "" elsewhere. */
  Clicks: string;
  Link_Clicks: string;
  Impressions: string;
  /** Program could not be detected; the team should fill it in. */
  _review: boolean;
  _brand: string;
}

const EMPTY_TV = {
  TV_Rating_Total: "",
  "TV_Rating_15+BKK": "",
  "TV_Rating_15+URBAN": "",
  "TV_Rating_15+BKK&URBAN": "",
  "TV_Rating_15+RURAL": "",
  TV_Audience_Total: "",
  "TV_Audience_15+BKK": "",
  "TV_Audience_15+URBAN": "",
  "TV_Audience_15+BKK&URBAN": "",
  "TV_Audience_15+RURAL": "",
};

export function mapPost(network: Network, post: Post, brand: BrandConfig): MappedRow | null {
  const n = (k: string) => parseNumber(post[k]);
  // Raw value as the API sends it ("" when the field is missing), up to 3 decimals.
  const raw = (k: string) => (post[k] === undefined || post[k] === null || post[k] === "" ? "" : String(Math.round(n(k) * 1000) / 1000));
  let watch = { avg: "", length: "", skip: "" };
  let clicks = { clicks: "", link: "", impressions: "" };
  let platform: string, url: string, id: string, text: string, when: unknown;
  let views: number, likes: number, comments: number, shares: number, durationSec: number;
  let videoViews = -1; // -1 = not a Facebook post
  switch (network) {
    case "facebook":
      platform = "Facebook";
      url = String(post.link ?? "");
      id = String(post.postId ?? "").split("_").pop() || postId(platform, url);
      text = String(post.text ?? "");
      when = post.timestamp ?? post.created;
      // Views follow Meta's "Views" (content shown or played) = impressions, as
      // in the team's data; video views only when impressions are missing.
      // Watched-video counts are kept separately in Video_Views.
      views = n("impressions") || n("videoViews");
      videoViews = n("videoViews");
      clicks = { clicks: raw("clicks"), link: raw("linkclicks"), impressions: raw("impressions") };
      likes = n("reactions");
      comments = n("comments");
      shares = n("shares");
      durationSec = 0;
      break;
    case "fbreels":
      platform = "Facebook";
      url = String(post.reelUrl ?? "");
      id = String(post.reelId ?? "") || postId(platform, url);
      text = String(post.description ?? "");
      when = post.created;
      // Matches the team data: plays = views, reactions = likes, social actions = comments.
      views = n("blueReelsPlayCount");
      likes = n("postVideoReactions");
      comments = n("postVideoSocialActions");
      shares = 0;
      durationSec = n("length");
      watch = { avg: raw("postVideoAvgTimeWatchedSeconds"), length: raw("length"), skip: "" };
      break;
    case "instagram":
    case "reels":
      platform = "Instagram";
      url = String(post.url ?? "");
      id = postId(platform, url) || String(post.postId ?? post.reelId ?? "");
      text = String(post.content ?? "");
      when = post.publishedAt;
      views = n("views"); // Meta "views"; never impressions
      likes = n("likes");
      comments = n("comments");
      shares = n("shares");
      durationSec = n("durationSeconds");
      if (network === "reels") watch = { avg: raw("averageWatchTime"), length: raw("durationSeconds"), skip: raw("reelsSkipRate") };
      break;
    case "tiktok":
      platform = "TikTok";
      url = String(post.shareUrl ?? post.embedLink ?? "");
      id = String(post.videoId ?? "") || postId(platform, url);
      text = String(post.videoDescription ?? post.title ?? "");
      when = post.createTime;
      views = n("viewCount");
      likes = n("likeCount");
      comments = n("commentCount");
      shares = n("shareCount");
      durationSec = n("duration");
      break;
    case "youtube":
      platform = "YouTube";
      id = String(post.videoId ?? "");
      url = String(post.watchUrl ?? (id ? `https://www.youtube.com/watch?v=${id}` : ""));
      text = `${post.title ?? ""}\n${post.description ?? ""}`;
      when = post.publishedAt;
      views = n("views");
      likes = n("likes");
      comments = n("comments");
      shares = n("shares");
      durationSec = n("durationSeconds");
      watch = { avg: raw("averageViewDuration"), length: raw("durationSeconds"), skip: "" };
      break;
  }
  const utc = postTimeUtc(when);
  if (!id || !Number.isFinite(utc)) return null;
  const t = bangkokParts(utc);
  const engagement = likes + comments + shares;
  // YouTube descriptions often plug other shows, so the title decides first.
  const detected =
    network === "youtube"
      ? [detectProgram(String(post.title ?? "")), detectProgram(text)].find((p) => p !== "ไม่ระบุ") || "ไม่ระบุ"
      : detectProgram(text);
  const program = brand.mode === "single" && brand.program ? brand.program : detected;
  const topic = firstLine(network === "youtube" ? String(post.title ?? "") : text, `${platform} ${t.iso} ${t.time}`);

  return {
    Date: t.iso, // masterData stores plain "YYYY-MM-DD" days
    Program: program,
    Episode_ID: "",
    Topic: topic.slice(0, 300),
    Topic_Type: inferTopicType(text),
    VDO_Type: vdoType(network, post, text),
    Platform: platform,
    Channel: brand.label,
    Content_ID: id,
    URL: url,
    Publish_Time: t.time,
    Duration_Min: (durationSec / 60).toFixed(2),
    Views: formatWhole(views),
    Likes: formatWhole(likes),
    Comments: formatWhole(comments),
    Shares: formatWhole(shares),
    Engagement: formatWhole(engagement),
    Engagement_Rate: formatPercent(views > 0 ? (engagement / views) * 100 : 0),
    Video_Views: videoViews >= 0 ? formatWhole(videoViews) : "",
    Avg_Watch_Sec: watch.avg,
    Video_Length_Sec: watch.avg ? watch.length : "",
    Skip_Rate: watch.skip,
    Clicks: clicks.clicks,
    Link_Clicks: clicks.link,
    Impressions: clicks.impressions,
    ...EMPTY_TV,
    Best_of_Month: "",
    Upload_Count: "1",
    Revenue: "",
    Notes: `Metricool: ${brand.label}`,
    _review: program === "ไม่ระบุ",
    _brand: brand.label,
  };
}

// ---------- merge ----------

/** Columns Metricool keeps up to date on rows that already exist. */
export const METRIC_COLUMNS = [
  "Views", "Likes", "Comments", "Shares", "Engagement", "Engagement_Rate", "Video_Views",
  "Avg_Watch_Sec", "Video_Length_Sec", "Skip_Rate",
  "Clicks", "Link_Clicks", "Impressions",
] as const;

export interface MergeResult {
  merged: Record<string, unknown>[];
  inserted: MappedRow[];
  updated: { key: string; before: Record<string, unknown>; after: Record<string, string> }[];
  unchanged: number;
}

/**
 * Existing rows (matched by platform + post id) only get METRIC_COLUMNS;
 * Program, Topic, Topic_Type, VDO_Type, Episode_ID, Best_of_Month, Revenue,
 * Notes and TV columns stay as the team left them. Unknown posts are added.
 */
export function mergeIntoMaster(master: Record<string, unknown>[], incoming: MappedRow[]): MergeResult {
  const index = new Map<string, number>();
  master.forEach((row, i) => {
    const key = rowKey(row as { Platform?: unknown; URL?: unknown; Content_ID?: unknown });
    if (key && !index.has(key)) index.set(key, i);
  });
  const merged = [...master];
  const inserted: MappedRow[] = [];
  const updated: MergeResult["updated"] = [];
  let unchanged = 0;
  const seen = new Set<string>();

  for (const row of incoming) {
    const key = rowKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const at = index.get(key);
    if (at === undefined) {
      const { _review: _, _brand: __, ...clean } = row;
      merged.push(clean);
      inserted.push(row);
      continue;
    }
    const existing = merged[at];
    const after: Record<string, string> = {};
    for (const col of METRIC_COLUMNS) {
      if (parseNumber(existing[col]) !== parseNumber(row[col])) after[col] = row[col];
    }
    if (Object.keys(after).length) {
      merged[at] = { ...existing, ...after };
      updated.push({ key, before: Object.fromEntries(METRIC_COLUMNS.map((c) => [c, existing[c]])), after });
    } else {
      unchanged++;
    }
  }
  return { merged, inserted, updated, unchanged };
}

// ---------- daily snapshot ----------

/** One post's numbers on a given day. Keys stay short: a day can hold thousands. */
export interface SnapshotRow {
  k: string; // rowKey: "Platform|postId"
  v: number; // views
  l: number; // likes
  c: number; // comments
  s: number; // shares
}

/** Rows per Firestore document (~70 bytes each, well under the 1 MB limit). */
export const SNAPSHOT_CHUNK = 5000;

/**
 * Posts whose numbers changed today (updated) or appeared today (inserted).
 * Unchanged posts are left out; reading a day falls back to the latest
 * earlier value for them. Snapshots are written once and never overwritten.
 */
export function buildSnapshot(result: Pick<MergeResult, "updated" | "inserted" | "merged">): SnapshotRow[] {
  const keys = new Set<string>([
    ...result.updated.map((u) => u.key),
    ...result.inserted.map((r) => rowKey(r)),
  ]);
  const rows: SnapshotRow[] = [];
  for (const row of result.merged) {
    const key = rowKey(row as { Platform?: unknown; URL?: unknown; Content_ID?: unknown });
    if (!key || !keys.has(key)) continue;
    keys.delete(key);
    rows.push({
      k: key,
      v: parseNumber(row.Views),
      l: parseNumber(row.Likes),
      c: parseNumber(row.Comments),
      s: parseNumber(row.Shares),
    });
  }
  return rows;
}

/** Split a snapshot into Firestore-sized documents: snapshots/{date}/chunks/{nnn}. */
export function chunkSnapshot(rows: SnapshotRow[], size = SNAPSHOT_CHUNK): SnapshotRow[][] {
  const chunks: SnapshotRow[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

// ---------- duplicate cleanup ----------

const DIGITAL_PLATFORMS = new Set(["Facebook", "Instagram", "TikTok", "YouTube"]);
/** Team-filled columns a kept duplicate may borrow when its own value is blank. */
const CURATED_COLUMNS = ["Program", "Topic", "Topic_Type", "VDO_Type", "Episode_ID", "Best_of_Month", "Revenue", "Notes"];
const blankish = (v: unknown) => v === undefined || v === null || String(v).trim() === "" || String(v).trim() === "ไม่ระบุ";

export interface DedupeResult {
  rows: Record<string, unknown>[];
  removed: { key: string; row: Record<string, unknown> }[];
  groups: number;
}

/**
 * The same digital post imported more than once was counted twice on the
 * dashboard. Keep one row per platform + post id: the one with the most views
 * (lifetime counts only grow, so it is the newest), borrowing team columns it
 * lacks from the copies. TV rows and rows without a post id are left alone.
 */
export function dedupeDigitalRows(rows: Record<string, unknown>[]): DedupeResult {
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (!DIGITAL_PLATFORMS.has(String(r.Platform))) return;
    const key = rowKey(r as { Platform?: unknown; URL?: unknown; Content_ID?: unknown });
    if (!key) return;
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  });

  const drop = new Set<number>();
  const replace = new Map<number, Record<string, unknown>>();
  const removed: DedupeResult["removed"] = [];
  let dupGroups = 0;
  for (const [key, idx] of groups) {
    if (idx.length < 2) continue;
    dupGroups++;
    const keepAt = idx.reduce((best, i) => (parseNumber(rows[i].Views) > parseNumber(rows[best].Views) ? i : best), idx[0]);
    const kept = { ...rows[keepAt] };
    for (const i of idx) {
      if (i === keepAt) continue;
      for (const col of CURATED_COLUMNS) if (blankish(kept[col]) && !blankish(rows[i][col])) kept[col] = rows[i][col];
      drop.add(i);
      removed.push({ key, row: rows[i] });
    }
    replace.set(keepAt, kept);
  }
  return {
    rows: rows.flatMap((r, i) => (drop.has(i) ? [] : [replace.get(i) ?? r])),
    removed,
    groups: dupGroups,
  };
}
