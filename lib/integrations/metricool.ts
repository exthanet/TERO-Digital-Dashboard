/**
 * Metricool API Integration Client
 * Handles communication with Metricool API for Facebook, Instagram, TikTok, and YouTube analytics.
 */

export interface MetricoolConfig {
  userId?: string;
  blogId?: string;
  apiToken?: string;
  baseUrl?: string;
}

export interface MetricoolDateRange {
  from: string; // YYYY-MM-DD or ISO string
  to: string;   // YYYY-MM-DD or ISO string
}

export interface RawMetricoolPost {
  id?: string | number;
  postId?: string | number;
  content?: string;
  text?: string;
  caption?: string;
  url?: string;
  postLink?: string;
  permalink?: string;
  date?: string;
  timestamp?: string;
  dateTime?: string;
  type?: string;
  mediaType?: string;
  views?: number | string;
  videoViews?: number | string;
  impressions?: number | string;
  reach?: number | string;
  likes?: number | string;
  reactions?: number | string;
  comments?: number | string;
  shares?: number | string;
  shared?: number | string;
  saved?: number | string;
  clicks?: number | string;
  interactions?: number | string;
  engagement?: number | string;
  engagementRate?: number | string;
  duration?: number | string;
  [key: string]: unknown;
}

export interface MasterRowOutput {
  Date: string;
  Program: string;
  Episode_ID: string;
  Topic: string;
  Topic_Type: string;
  VDO_Type: string;
  Platform: string;
  Channel: string;
  Content_ID: string;
  URL: string;
  Publish_Time: string;
  Duration_Min: string;
  Views: string;
  Likes: string;
  Comments: string;
  Shares: string;
  Engagement: string;
  Engagement_Rate: string;
  TV_Rating_Total: string;
  "TV_Rating_15+BKK": string;
  "TV_Rating_15+URBAN": string;
  "TV_Rating_15+BKK&URBAN": string;
  "TV_Rating_15+RURAL": string;
  TV_Audience_Total: string;
  "TV_Audience_15+BKK": string;
  "TV_Audience_15+URBAN": string;
  "TV_Audience_15+BKK&URBAN": string;
  "TV_Audience_15+RURAL": string;
  Best_of_Month: string;
  Upload_Count: string;
  Revenue: string;
  Notes: string;
  [key: string]: unknown;
}

export function parseNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replaceAll(",", "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatWhole(value: unknown): string {
  return String(Math.round(parseNumber(value)));
}

export function formatPercent(value: unknown): string {
  return `${parseNumber(value).toFixed(2)}%`;
}

export function normalizeUrl(value: string | undefined): string {
  return String(value || "").trim().replace(/\/$/, "").toLowerCase();
}

export function splitTimestamp(value: unknown): { iso: string; date: string; time: string } | null {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return null;
  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  return {
    iso: `${year}-${month}-${day}`,
    date: `${day}/${month}/${year}`,
    time: match[4] ? `${match[4]}:${match[5]}` : "00:00",
  };
}

export function firstLine(value: unknown, fallback: string): string {
  const line = String(value || "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find((part) => part && part !== ".");
  return line || fallback;
}

export function inferProgram(content: unknown): string {
  const text = String(content || "").toLowerCase();
  if (text.includes("ถกไม่เถียง") || text.includes("ทินโชคกมลกิจ") || text.includes("ทิน โชคกมลกิจ")) return "ถกไม่เถียง";
  if (text.includes("เงินทองของจริง")) return "เงินทองของจริง";
  if (text.includes("kids fun") || text.includes("kidsfun")) return "Kidsfun";
  if (text.includes("hitz") || text.includes("ฮิตซ์")) return "Hitzradio";
  return "ไม่ระบุ";
}

export function inferTopicType(content: unknown): string {
  const text = String(content || "").toLowerCase();
  if (/ลูกค้า|โฆษณา|สปอนเซอร์|branded|promotion|โปรโมชัน/.test(text)) return "งานลูกค้า / งานขอ / Branded Content";
  if (/กัมพูชา|เขมร|ฮุน เซน|ฮุนเซน|ชายแดนไทย/.test(text)) return "ข่าวไทย–กัมพูชา";
  if (/อิหร่าน|สหรัฐ|ต่างประเทศ|ทรัมป์|รัสเซีย|ยูเครน|จีน|ญี่ปุ่น/.test(text)) return "ข่าวต่างประเทศ / อิหร่าน–สหรัฐ";
  if (/ตำรวจ|อาชญากรรม|สแกมเมอร์|ฆาตกรรม|ยิง|คดี|โกง|จับกุม|ยาเสพติด/.test(text)) return "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์";
  if (/ผู้ว่า\s*กทม|บิ๊กโจ๊ก|การเมืองท้องถิ่น/.test(text)) return "ข่าวบุคคล / การเมืองท้องถิ่น";
  if (/รัฐบาล|นายก|สภา|สว\.?|สส\.?|กกต|พรรค|การเมือง|อนุทิน|เลือกตั้ง|รัฐมนตรี|ฮั้ว/.test(text)) return "ข่าวการเมือง";
  if (/ประวัติศาสตร์|โบราณ|อดีต/.test(text)) return "ประวัติศาสตร์";
  if (/พระเครื่อง|วัตถุมงคล|เกจิ/.test(text)) return "พระเครื่อง";
  if (/ไวรัล|viral|กระแส|โซเชียล|ดราม่า/.test(text)) return "ข่าวกระแส / Viral";
  if (/ชาวบ้าน|ชุมชน|ร้องทุกข์/.test(text)) return "ข่าวชาวบ้าน";
  return "ไม่ระบุ";
}

export function generateFacebookId(url: string): string {
  const match = String(url || "").match(/\/(?:posts|videos)\/(\d+)/i);
  if (match?.[1]) return `FB-${match[1]}`;
  const slug = String(url || "").replace(/[^a-zA-Z0-9]/g, "").slice(-18);
  return `FB-${slug || Date.now()}`;
}

export function transformFacebookPost(post: RawMetricoolPost): MasterRowOutput | null {
  const rawDate = post.date || post.timestamp || post.dateTime;
  const timestamp = splitTimestamp(rawDate);
  const link = (post.postLink || post.url || post.permalink || "").trim();
  if (!timestamp || !link) return null;

  const content = post.content || post.text || post.message || "";
  const isVideo = parseNumber(post.videoViews) > 0 || String(post.type || "").toLowerCase() === "video";
  const views = isVideo ? parseNumber(post.videoViews) : parseNumber(post.impressions || post.views);
  const likes = parseNumber(post.reactions || post.likes);
  const comments = parseNumber(post.comments);
  const shares = parseNumber(post.shared || post.shares);
  const engagement = likes + comments + shares;
  const rate = parseNumber(post.engagement || post.engagementRate) || (views > 0 ? (engagement / views) * 100 : 0);

  const fallback = `Facebook ${post.type || "post"} (${timestamp.iso} ${timestamp.time})`;

  return {
    Date: timestamp.date,
    Program: inferProgram(content),
    Episode_ID: "",
    Topic: firstLine(content, fallback),
    Topic_Type: inferTopicType(content),
    VDO_Type: isVideo ? "Facebook Video" : "Facebook Post",
    Platform: "Facebook",
    Channel: "-",
    Content_ID: generateFacebookId(link),
    URL: link,
    Publish_Time: timestamp.time,
    Duration_Min: "0.00",
    Views: formatWhole(views),
    Likes: formatWhole(likes),
    Comments: formatWhole(comments),
    Shares: formatWhole(shares),
    Engagement: formatWhole(engagement),
    Engagement_Rate: formatPercent(rate),
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
    Revenue: "0",
    Notes: `Metricool API; Type=${post.type || "post"}; Reach=${formatWhole(post.reach)}; Clicks=${formatWhole(post.clicks)}`,
  };
}

export function transformInstagramPost(post: RawMetricoolPost, isReel = false): MasterRowOutput | null {
  const rawDate = post.timestamp || post.date || post.dateTime;
  const timestamp = splitTimestamp(rawDate);
  const link = (post.url || post.permalink || post.postLink || "").trim();
  if (!timestamp || !link) return null;

  const content = post.content || post.caption || post.text || "";
  const views = parseNumber(post.views || post.impressions || post.videoViews);
  const likes = parseNumber(post.likes);
  const comments = parseNumber(post.comments);
  const shares = parseNumber(post.shares || post.shared);
  const saved = parseNumber(post.saved);
  const engagement = parseNumber(post.interactions) || (likes + comments + shares + saved);
  const rate = parseNumber(post.engagement || post.engagementRate) || (views > 0 ? (engagement / views) * 100 : 0);

  const fallback = `Instagram ${isReel ? "Reel" : (post.type || "post")} (${timestamp.iso} ${timestamp.time})`;
  const rawId = String(post.id || post.postId || "");
  const contentId = rawId ? `IG-${rawId}` : `IG-${link.split("/").filter(Boolean).pop()}`;

  return {
    Date: timestamp.date,
    Program: inferProgram(content),
    Episode_ID: "",
    Topic: firstLine(content, fallback),
    Topic_Type: inferTopicType(content),
    VDO_Type: isReel ? "Facebook/IG Reels" : "Instagram Post",
    Platform: "Instagram",
    Channel: "-",
    Content_ID: contentId,
    URL: link,
    Publish_Time: timestamp.time,
    Duration_Min: "0.00",
    Views: formatWhole(views),
    Likes: formatWhole(likes),
    Comments: formatWhole(comments),
    Shares: formatWhole(shares),
    Engagement: formatWhole(engagement),
    Engagement_Rate: formatPercent(rate),
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
    Revenue: "0",
    Notes: `Metricool API; Type=${isReel ? "reel" : (post.type || "post")}; Reach=${formatWhole(post.reach)}; Saved=${formatWhole(saved)}`,
  };
}

export function transformTikTokPost(post: RawMetricoolPost): MasterRowOutput | null {
  const rawDate = post.date || post.timestamp || post.dateTime;
  const timestamp = splitTimestamp(rawDate);
  const link = (post.url || post.postLink || post.permalink || "").trim();
  if (!timestamp || !link) return null;

  const content = post.content || post.text || post.caption || "";
  const views = parseNumber(post.views || post.videoViews);
  const likes = parseNumber(post.likes);
  const comments = parseNumber(post.comments);
  const shares = parseNumber(post.shares || post.shared);
  const engagement = likes + comments + shares;
  const rate = parseNumber(post.engagement || post.engagementRate) || (views > 0 ? (engagement / views) * 100 : 0);

  const fallback = `TikTok video (${timestamp.iso} ${timestamp.time})`;
  const rawId = String(post.id || post.postId || "");
  const contentId = rawId ? `TT-${rawId}` : `TT-${link.split("/").filter(Boolean).pop()}`;

  return {
    Date: timestamp.date,
    Program: inferProgram(content),
    Episode_ID: "",
    Topic: firstLine(content, fallback),
    Topic_Type: inferTopicType(content),
    VDO_Type: "TikTok",
    Platform: "TikTok",
    Channel: "-",
    Content_ID: contentId,
    URL: link,
    Publish_Time: timestamp.time,
    Duration_Min: formatWhole(parseNumber(post.duration) / 60),
    Views: formatWhole(views),
    Likes: formatWhole(likes),
    Comments: formatWhole(comments),
    Shares: formatWhole(shares),
    Engagement: formatWhole(engagement),
    Engagement_Rate: formatPercent(rate),
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
    Revenue: "0",
    Notes: `Metricool API; Reach=${formatWhole(post.reach)}`,
  };
}

export class MetricoolClient {
  private userId: string;
  private blogId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor(config: MetricoolConfig = {}) {
    this.userId = config.userId || process.env.METRICOOL_USER_ID || "";
    this.blogId = config.blogId || process.env.METRICOOL_BLOG_ID || "";
    this.apiToken = config.apiToken || process.env.METRICOOL_API_TOKEN || "";
    this.baseUrl = (config.baseUrl || "https://app.metricool.com/api").replace(/\/$/, "");
  }

  public isConfigured(): boolean {
    return Boolean(this.userId && this.blogId && this.apiToken);
  }

  public getMissingKeys(): string[] {
    const missing: string[] = [];
    if (!this.userId) missing.push("METRICOOL_USER_ID");
    if (!this.blogId) missing.push("METRICOOL_BLOG_ID");
    if (!this.apiToken) missing.push("METRICOOL_API_TOKEN");
    return missing;
  }

  private buildUrl(endpoint: string, params: Record<string, string | number | undefined> = {}): string {
    const url = new URL(`${this.baseUrl}/${endpoint.replace(/^\//, "")}`);
    url.searchParams.set("userId", this.userId);
    url.searchParams.set("blogId", this.blogId);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request<T = unknown>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error(`Metricool credentials incomplete. Missing: ${this.getMissingKeys().join(", ")}`);
    }

    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Mc-Auth": this.apiToken,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Metricool API Error (${response.status} ${response.statusText}) on ${endpoint}: ${errorText || "No response body"}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Test connection to Metricool by checking credentials
   */
  public async testConnection(): Promise<{ success: boolean; message: string; data?: unknown }> {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          message: `Config missing: ${this.getMissingKeys().join(", ")}`,
        };
      }
      // Attempt to query blog info or lightweight endpoint
      const result = await this.request<unknown>("v2/blogs");
      return { success: true, message: "Connected successfully to Metricool API", data: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  /**
   * Fetch Facebook posts within date range
   */
  public async fetchFacebookPosts(range: MetricoolDateRange): Promise<RawMetricoolPost[]> {
    const data = await this.request<RawMetricoolPost[] | { posts?: RawMetricoolPost[] }>(
      "v2/analytics/posts/facebook",
      { from: range.from, to: range.to }
    );
    return Array.isArray(data) ? data : (data.posts || []);
  }

  /**
   * Fetch Instagram posts within date range
   */
  public async fetchInstagramPosts(range: MetricoolDateRange): Promise<RawMetricoolPost[]> {
    const data = await this.request<RawMetricoolPost[] | { posts?: RawMetricoolPost[] }>(
      "v2/analytics/posts/instagram",
      { from: range.from, to: range.to }
    );
    return Array.isArray(data) ? data : (data.posts || []);
  }

  /**
   * Fetch Instagram reels within date range
   */
  public async fetchInstagramReels(range: MetricoolDateRange): Promise<RawMetricoolPost[]> {
    const data = await this.request<RawMetricoolPost[] | { reels?: RawMetricoolPost[]; posts?: RawMetricoolPost[] }>(
      "v2/analytics/reels/instagram",
      { from: range.from, to: range.to }
    );
    if (Array.isArray(data)) return data;
    return data.reels || data.posts || [];
  }

  /**
   * Fetch TikTok posts within date range
   */
  public async fetchTikTokPosts(range: MetricoolDateRange): Promise<RawMetricoolPost[]> {
    const data = await this.request<RawMetricoolPost[] | { posts?: RawMetricoolPost[] }>(
      "v2/analytics/posts/tiktok",
      { from: range.from, to: range.to }
    );
    return Array.isArray(data) ? data : (data.posts || []);
  }

  /**
   * Fetch and transform all social posts across configured networks
   */
  public async fetchAllMasterRows(range: MetricoolDateRange): Promise<{
    rows: MasterRowOutput[];
    stats: Record<string, number>;
  }> {
    const rows: MasterRowOutput[] = [];
    const stats: Record<string, number> = { Facebook: 0, Instagram: 0, InstagramReels: 0, TikTok: 0 };

    // Facebook
    try {
      const fbPosts = await this.fetchFacebookPosts(range);
      for (const p of fbPosts) {
        const row = transformFacebookPost(p);
        if (row) {
          rows.push(row);
          stats.Facebook += 1;
        }
      }
    } catch (err) {
      console.warn("Could not fetch Facebook posts from Metricool:", err instanceof Error ? err.message : err);
    }

    // Instagram Posts
    try {
      const igPosts = await this.fetchInstagramPosts(range);
      for (const p of igPosts) {
        const row = transformInstagramPost(p, false);
        if (row) {
          rows.push(row);
          stats.Instagram += 1;
        }
      }
    } catch (err) {
      console.warn("Could not fetch Instagram posts from Metricool:", err instanceof Error ? err.message : err);
    }

    // Instagram Reels
    try {
      const igReels = await this.fetchInstagramReels(range);
      for (const p of igReels) {
        const row = transformInstagramPost(p, true);
        if (row) {
          rows.push(row);
          stats.InstagramReels += 1;
        }
      }
    } catch (err) {
      console.warn("Could not fetch Instagram reels from Metricool:", err instanceof Error ? err.message : err);
    }

    // TikTok
    try {
      const ttPosts = await this.fetchTikTokPosts(range);
      for (const p of ttPosts) {
        const row = transformTikTokPost(p);
        if (row) {
          rows.push(row);
          stats.TikTok += 1;
        }
      }
    } catch (err) {
      console.warn("Could not fetch TikTok posts from Metricool:", err instanceof Error ? err.message : err);
    }

    return { rows, stats };
  }
}

/**
 * Merge incoming normalized rows into master data list
 */
export function mergeMetricoolIntoMaster(
  masterList: MasterRowOutput[],
  incomingRows: MasterRowOutput[]
): {
  merged: MasterRowOutput[];
  inserted: number;
  updated: number;
} {
  const indexByUrl = new Map<string, number>();
  const indexByContentId = new Map<string, number>();

  masterList.forEach((row, idx) => {
    if (row.URL) {
      indexByUrl.set(normalizeUrl(row.URL), idx);
    }
    if (row.Content_ID) {
      indexByContentId.set(String(row.Content_ID).trim(), idx);
    }
  });

  let inserted = 0;
  let updated = 0;
  const merged = [...masterList];

  for (const row of incomingRows) {
    const normUrl = normalizeUrl(row.URL);
    let existingIndex = normUrl ? indexByUrl.get(normUrl) : undefined;
    if (existingIndex === undefined && row.Content_ID) {
      existingIndex = indexByContentId.get(String(row.Content_ID).trim());
    }

    if (existingIndex === undefined) {
      const newIdx = merged.length;
      merged.push(row);
      if (normUrl) indexByUrl.set(normUrl, newIdx);
      if (row.Content_ID) indexByContentId.set(String(row.Content_ID).trim(), newIdx);
      inserted += 1;
    } else {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        ...row,
        Program: existing.Program && existing.Program !== "ไม่ระบุ" ? existing.Program : row.Program,
        Topic: existing.Topic || row.Topic,
        Topic_Type: existing.Topic_Type && existing.Topic_Type !== "ไม่ระบุ" ? existing.Topic_Type : row.Topic_Type,
      };
      updated += 1;
    }
  }

  return { merged, inserted, updated };
}
