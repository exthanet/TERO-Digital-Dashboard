// Advanced → YouTube Deep Dive: YouTube Analytics numbers (ytAnalytics/*) joined
// with the clips on the page (title, type, topic). Raw numbers as YouTube gives
// them; this file only joins, groups and divides.
//
// Relative imports only: tests run this file directly with Node.
import { postId } from "./postKey.ts";
import type { RecordRow } from "./types.ts";

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
  traffic?: Record<string, number>;
}

export interface YtWindow {
  start: string;
  end: string;
  traffic: { source: string; views: number }[];
  searchTerms: { term: string; views: number }[];
  contentType: { type: string; views: number; revenue: number }[];
}

export interface YtDeepDiveData {
  updatedAt: string;
  videos: YtVideo[];
  windows: { d28: YtWindow; d90: YtWindow } | null;
  retention: { id: string; points: { at: number; watch: number; relative: number }[] }[];
  search: Record<string, { term: string; views: number }[]>;
}

export type Format = "Shorts" | "Video" | "Live";
export const formatOf = (vdoType: string): Format => (/short/i.test(vdoType) ? "Shorts" : /live/i.test(vdoType) ? "Live" : "Video");

export interface DeepItem {
  v: YtVideo;
  row: RecordRow;
  format: Format;
  /** Shorts: engaged views ÷ views (viewers who kept watching instead of swiping away). */
  hookRate: number | null;
  /** Share of the video watched on average (can pass 100% with re-watches). */
  holdPct: number;
  er: number;
  rpm: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The page's YouTube clips that YouTube Analytics has numbers for. */
export function joinVideos(data: YtDeepDiveData, rows: RecordRow[]): DeepItem[] {
  const byId = new Map(data.videos.map((v) => [v.id, v]));
  const seen = new Set<string>();
  const out: DeepItem[] = [];
  for (const row of rows) {
    if (row.platform !== "YouTube") continue;
    const id = postId("YouTube", row.url) || postId("YouTube", row.contentId);
    const v = id ? byId.get(id) : undefined;
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    const format = formatOf(row.vdoType);
    out.push({
      v,
      row,
      format,
      hookRate: format === "Shorts" && v.views > 0 ? v.engagedViews / v.views : null,
      holdPct: v.avgViewPct,
      er: v.views > 0 ? (v.likes + v.comments + v.shares) / v.views : 0,
      rpm: v.views > 0 ? (v.revenue / v.views) * 1000 : 0,
    });
  }
  return out.sort((a, b) => b.v.views - a.v.views);
}

export type Quadrant = "formula" | "weakBody" | "weakHook" | "drop";

/**
 * Shorts against the median of the Shorts on the page: hook (kept watching vs
 * swiped) and hold (share watched). Long videos have no swipe, so they are left out.
 */
export function quadrants(items: DeepItem[]): { medianHook: number | null; medianHold: number | null; items: (DeepItem & { quadrant: Quadrant })[] } {
  const shorts = items.filter((x) => x.hookRate !== null);
  const medianHook = median(shorts.map((x) => x.hookRate!));
  const medianHold = median(shorts.map((x) => x.holdPct));
  return {
    medianHook,
    medianHold,
    items: shorts.map((x) => {
      const hook = x.hookRate! >= (medianHook ?? 0);
      const hold = x.holdPct >= (medianHold ?? 0);
      return { ...x, quadrant: hook && hold ? "formula" : hook ? "weakBody" : hold ? "weakHook" : "drop" };
    }),
  };
}

export interface GroupStat {
  name: string;
  videos: number;
  views: number;
  revenue: number;
  /** Revenue per 1,000 views. */
  rpm: number;
  er: number;
  commentsPer1k: number;
  sharesPer1k: number;
  subsPer1k: number;
  /** Median share watched. */
  holdPct: number | null;
  /** Median hook rate (Shorts only). */
  hookRate: number | null;
}

export function groupBy(items: DeepItem[], key: (x: DeepItem) => string): GroupStat[] {
  const m = new Map<string, DeepItem[]>();
  for (const x of items) m.set(key(x) || "ไม่ระบุ", [...(m.get(key(x) || "ไม่ระบุ") || []), x]);
  return [...m.entries()]
    .map(([name, list]) => {
      const sum = (f: (v: YtVideo) => number) => list.reduce((a, x) => a + f(x.v), 0);
      const views = sum((v) => v.views);
      const per1k = (n: number) => (views > 0 ? (n / views) * 1000 : 0);
      const hooks = list.map((x) => x.hookRate).filter((h): h is number => h !== null);
      return {
        name,
        videos: list.length,
        views,
        revenue: sum((v) => v.revenue),
        rpm: per1k(sum((v) => v.revenue)),
        er: views > 0 ? sum((v) => v.likes + v.comments + v.shares) / views : 0,
        commentsPer1k: per1k(sum((v) => v.comments)),
        sharesPer1k: per1k(sum((v) => v.shares)),
        subsPer1k: per1k(sum((v) => v.subs)),
        holdPct: median(list.map((x) => x.holdPct)),
        hookRate: median(hooks),
      };
    })
    .sort((a, b) => b.views - a.views);
}

const norm = (t: string) => t.toLowerCase().replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();

/**
 * How well a video's search terms match its own title: share of its search
 * views from terms whose every word appears in the title (Thai has no spaces,
 * so each space-separated part is looked up as text).
 */
export function keywordRelevance(title: string, terms: { term: string; views: number }[]): number | null {
  const total = terms.reduce((a, t) => a + t.views, 0);
  if (!total) return null;
  const t = norm(title).replace(/\s+/g, "");
  const hit = terms.filter((x) => norm(x.term).split(" ").every((w) => w && t.includes(w))).reduce((a, x) => a + x.views, 0);
  return hit / total;
}

/** Channel search terms that no clip title on the page contains: topics people look for. */
export function searchGaps(terms: { term: string; views: number }[], titles: string[], skip: RegExp = /ถกไม่เถียง|tero/i): { term: string; views: number }[] {
  const all = titles.map((x) => norm(x).replace(/\s+/g, ""));
  return terms.filter((x) => !skip.test(x.term) && !all.some((t) => norm(x.term).split(" ").every((w) => w && t.includes(w))));
}

/** Traffic source labels in Thai. */
export const TRAFFIC_LABEL: Record<string, string> = {
  SHORTS: "หน้า Shorts",
  SUBSCRIBER: "ผู้ติดตาม / หน้าแรก",
  RELATED_VIDEO: "วิดีโอแนะนำ",
  YT_SEARCH: "ค้นหาใน YouTube",
  YT_OTHER_PAGE: "หน้าอื่นใน YouTube",
  EXT_URL: "เว็บไซต์ภายนอก",
  NO_LINK_OTHER: "เข้าตรง / ไม่ทราบ",
  PLAYLIST: "เพลย์ลิสต์",
  YT_CHANNEL: "หน้าช่อง",
  NOTIFICATION: "การแจ้งเตือน",
  END_SCREEN: "หน้าจอตอนจบ",
  ANNOTATION: "การ์ด / annotation",
  HASHTAGS: "แฮชแท็ก",
  SOUND_PAGE: "หน้าเสียง",
  LIVE_REDIRECT: "Live redirect",
  YT_PLAYLIST_PAGE: "หน้าเพลย์ลิสต์",
  CAMPAIGN_CARD: "แคมเปญ",
  SUBSCRIBERS: "ผู้ติดตาม",
  VIDEO_REMIXES: "รีมิกซ์",
  PRODUCT_PAGE: "หน้าสินค้า",
  ADVERTISING: "โฆษณา",
  IMMERSIVE_LIVE: "Live แบบเต็มจอ",
};
export const CONTENT_TYPE_LABEL: Record<string, string> = { videoOnDemand: "วิดีโอ", shorts: "Shorts", liveStream: "Live", posts: "โพสต์", creatorContentTypeUnspecified: "ไม่ระบุ" };
