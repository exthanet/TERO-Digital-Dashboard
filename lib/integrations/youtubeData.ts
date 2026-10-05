// YouTube Data API v3 (API key, public data) to back up Metricool for YouTube.
//
// Why: Metricool skipped ~11% of TERO Digital's August videos, lags 2–3 days
// and counts views only inside the requested window. The Data API lists every
// upload and returns live lifetime counts. It has no "shares", so Metricool's
// shares are kept where Metricool has the video.
//
// Quota: 10,000 units/day free. playlistItems.list and videos.list cost 1 unit
// per call of up to 50 items, so ~5,000 videos ≈ 200 units.
import { formatPercent, formatWhole, inferTopicType, firstLine } from "./metricool.ts";
import { bangkokParts, detectProgram, type BrandConfig, type MappedRow } from "./metricoolSync.ts";

const API = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string; // UTC ISO
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  /** Was or is a live stream. */
  live: boolean;
}

/** ISO 8601 duration (PT1H2M3S) → seconds. */
export function parseIsoDuration(value: string): number {
  const m = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Number(d || 0) * 86400 + Number(h || 0) * 3600 + Number(min || 0) * 60 + Number(s || 0);
}

/** A channel's "uploads" playlist is the channel id with UC → UU. */
export const uploadsPlaylist = (channelId: string) => `UU${channelId.slice(2)}`;

export class YouTubeDataApi {
  private key: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is required");
    this.key = apiKey;
  }

  private async get(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(`${API}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", this.key);
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (body.error as { message?: string } | undefined)?.message || res.statusText;
      throw new Error(`YouTube Data API ${res.status} on ${path}: ${err}`);
    }
    return body;
  }

  /** Video ids uploaded on or after `sinceIso` (UTC), newest first. */
  async listUploads(channelId: string, sinceIso: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken = "";
    for (;;) {
      const body = await this.get("playlistItems", {
        part: "contentDetails",
        playlistId: uploadsPlaylist(channelId),
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      const items = (body.items as { contentDetails: { videoId: string; videoPublishedAt?: string } }[]) || [];
      let reachedOlder = false;
      for (const it of items) {
        const at = it.contentDetails.videoPublishedAt || "";
        // Private/deleted videos have no publish time; skip them.
        if (!at) continue;
        if (at < sinceIso) {
          reachedOlder = true;
          continue;
        }
        ids.push(it.contentDetails.videoId);
      }
      pageToken = String(body.nextPageToken || "");
      // The uploads playlist is newest first, so stop once a page goes past `since`.
      if (!pageToken || reachedOlder) break;
    }
    return ids;
  }

  async videos(ids: string[]): Promise<YouTubeVideo[]> {
    const out: YouTubeVideo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const body = await this.get("videos", {
        part: "snippet,contentDetails,statistics,liveStreamingDetails",
        id: ids.slice(i, i + 50).join(","),
        maxResults: "50",
      });
      for (const v of (body.items as Record<string, Record<string, string>>[]) || []) {
        out.push({
          id: String(v.id),
          title: v.snippet?.title || "",
          description: v.snippet?.description || "",
          publishedAt: v.snippet?.publishedAt || "",
          durationSec: parseIsoDuration(v.contentDetails?.duration || ""),
          views: Number(v.statistics?.viewCount || 0),
          likes: Number(v.statistics?.likeCount || 0),
          comments: Number(v.statistics?.commentCount || 0),
          live: Boolean(v.liveStreamingDetails) || v.snippet?.liveBroadcastContent === "live",
        });
      }
    }
    return out;
  }
}

/**
 * Same row shape as the Metricool mapper. Format: live streams → "LIVE";
 * up to 3 minutes → "Shorts" (YouTube's Shorts limit; the Data API does not
 * flag Shorts); otherwise "Video Episode". Metricool's own SHORT flag wins
 * when both sources have the video.
 */
export function mapYouTubeVideo(v: YouTubeVideo, brand: BrandConfig): MappedRow | null {
  const utc = Date.parse(v.publishedAt);
  if (!v.id || !Number.isFinite(utc)) return null;
  const t = bangkokParts(utc);
  const text = `${v.title}\n${v.description}`;
  // The title decides first: descriptions often plug other shows.
  const detected = [detectProgram(v.title), detectProgram(text)].find((p) => p !== "ไม่ระบุ") || "ไม่ระบุ";
  const program = brand.mode === "single" && brand.program ? brand.program : detected;
  const engagement = v.likes + v.comments;
  return {
    Date: t.iso, // masterData stores plain "YYYY-MM-DD" days
    Program: program,
    Episode_ID: "",
    Topic: firstLine(v.title, `YouTube ${t.iso} ${t.time}`).slice(0, 300),
    Topic_Type: inferTopicType(text, v.title, program),
    VDO_Type: v.live ? "LIVE" : v.durationSec > 0 && v.durationSec <= 180 ? "Shorts" : "Video Episode",
    Platform: "YouTube",
    Channel: brand.label,
    Content_ID: v.id,
    URL: `https://www.youtube.com/watch?v=${v.id}`,
    Publish_Time: t.time,
    Duration_Min: (v.durationSec / 60).toFixed(2),
    Views: formatWhole(v.views),
    Likes: formatWhole(v.likes),
    Comments: formatWhole(v.comments),
    Shares: "0",
    Engagement: formatWhole(engagement),
    Engagement_Rate: formatPercent(v.views > 0 ? (engagement / v.views) * 100 : 0),
    Video_Views: "",
    // Watch time comes from Metricool (combineYouTube keeps it); the Data API has none.
    Avg_Watch_Sec: "",
    Video_Length_Sec: "",
    Skip_Rate: "",
    Clicks: "",
    Link_Clicks: "",
    Impressions: "",
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
    Best_of_Month: "",
    Upload_Count: "1",
    Revenue: "",
    Notes: `YouTube Data API: ${brand.label}`,
    _review: program === "ไม่ระบุ",
    _brand: brand.label,
  };
}

/**
 * Combine YouTube rows from both sources: the Data API's live views, likes and
 * comments win; Metricool keeps shares and its Shorts flag; videos only one
 * source has are kept as they are.
 */
export function combineYouTube(metricool: MappedRow[], dataApi: MappedRow[]): { rows: MappedRow[]; onlyDataApi: number } {
  const byId = new Map(metricool.map((r) => [r.Content_ID, r]));
  const rows = [...metricool];
  let onlyDataApi = 0;
  for (const d of dataApi) {
    const m = byId.get(d.Content_ID);
    if (!m) {
      rows.push(d);
      onlyDataApi++;
      continue;
    }
    const views = Number(d.Views);
    const likes = Number(d.Likes);
    const comments = Number(d.Comments);
    const shares = Number(m.Shares) || 0;
    const engagement = likes + comments + shares;
    Object.assign(m, {
      Views: d.Views,
      Likes: d.Likes,
      Comments: d.Comments,
      Engagement: formatWhole(engagement),
      Engagement_Rate: formatPercent(views > 0 ? (engagement / views) * 100 : 0),
    });
  }
  return { rows, onlyDataApi };
}
