// รายงานประจำเดือน: one month's numbers for the team meeting, frozen when an
// admin saves it (monthlyReports/{YYYY-MM}) so the figures never move after
// the meeting. Every number comes from the dashboard's own helpers, so the
// report matches the other pages; nothing here is typed in by hand and no
// revenue is included.
//
// Relative imports only: tests run this file directly with Node.
import type { RecordRow } from "./types.ts";
import { change, digitalKpis, formatMix, postingHeatmap, tvKpis, WEEKDAYS, type DigitalKpis, type TvKpis } from "./platformReport.ts";
import { programTable } from "./programReport.ts";
import { trendingHashtags } from "./trendingHashtags.ts";
import { competitorRanking, type CompetitorMode, type CompetitorRanking, type CompetitorRow } from "./competitors.ts";
import { formatOf, joinVideos, searchGaps, type YtDeepDiveData, type YtVideo } from "./ytDeepDive.ts";
import { parseHashtags } from "./hashtags.ts";
import type { GrowthEntry } from "./growth.ts";

/** 2 = adds `deep` (เชิงลึก pages); version 1 reports still open, without those pages. */
export const REPORT_VERSION = 2;
/** Platforms on the report, in this order when equal. */
export const REPORT_PLATFORMS = ["YouTube", "TikTok", "Facebook", "Instagram"] as const;
const MIN_TOPIC_POSTS = 10;
const MIN_SLOT_POSTS = 10;

export interface MonthPeriod {
  month: string;
  start: string;
  end: string;
}

/** "2026-09" → 1st to last day. */
export function monthPeriod(month: string): MonthPeriod {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month, start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export const previousMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "2026-09" → "กันยายน 2026". */
export const monthLabel = (month: string) => `${THAI_MONTHS[Number(month.slice(5, 7)) - 1] || month} ${month.slice(0, 4)}`;

/** The last month that has ended by `latestDate` (the newest data day). */
export function lastFullMonth(latestDate: string): string {
  const month = latestDate.slice(0, 7);
  return latestDate >= monthPeriod(month).end ? month : previousMonth(month);
}

export interface PlatformLine {
  platform: string;
  views: number;
  share: number;
  growth: number | null;
  posts: number;
  postsGrowth: number | null;
  medianViews: number;
  er: number;
}

export interface ProgramRow {
  program: string;
  views: number;
  share: number;
  growth: number | null;
  posts: number;
  medianViews: number;
  tvEpisodes: number;
  tvRating: number | null;
}

export interface ClipRow {
  topic: string;
  platform: string;
  program: string;
  date: string;
  views: number;
  url: string;
}

export interface TopicRow {
  topicType: string;
  posts: number;
  medianViews: number;
  /** Median against the month's median per post. */
  index: number;
}

export interface EpisodeRow {
  date: string;
  topic: string;
  topicType: string;
  rating: number;
  audience: number;
}

export interface ChannelTv {
  channel: "One31" | "GMM25";
  episodes: number;
  avg: number | null;
  prevAvg: number | null;
  audience: number;
  top: EpisodeRow[];
}

export interface CompetitorBlock {
  channel: string;
  program: string;
  mode: CompetitorMode;
  ranking: CompetitorRanking[];
}

export interface Recommendation {
  title: string;
  because: string;
  action: string;
}

export interface YoutubeGroup {
  videos: number;
  views: number;
  /** Seconds, weighted by views. */
  avgViewSec: number;
  /** Share of the video watched (%), weighted by views; can pass 100 with re-watches. */
  avgViewPct: number;
  subs: number;
}

export interface FeatureGroup {
  value: string;
  posts: number;
  /** Median views against the platform's median short (1 = typical). */
  index: number;
  /** Share of the clips that got 3× the typical views or more. */
  hitRate: number;
}

/** เชิงลึก pages. Taken from YouTube Analytics (ytAnalytics) and the daily gains when the admin makes the report; no revenue. */
export interface DeepReport {
  youtube: null | {
    matched: number;
    posts: number;
    shorts: YoutubeGroup;
    long: YoutubeGroup;
    newSubs: number;
    updatedAt: string;
    traffic: { source: string; share: number }[];
    trafficVideos: number;
  };
  engagement: { platform: string; sharesPer1k: number; commentsPer1k: number; avgWatchSec: number | null; skipRate: number | null }[];
  weekdays: { day: string; posts: number; views: number; avgPerDay: number }[];
  growth: null | { days: number; of: number; totalViews: number; perDay: number; peaks: { day: string; views: number }[] };
  shorts: { posts: number; features: { name: string; groups: FeatureGroup[] }[] };
  seo: null | {
    range: string;
    searchShare: number | null;
    brandShare: number | null;
    terms: { term: string; views: number }[];
    gaps: { term: string; views: number }[];
    posts: number;
    titleOver70: number;
    noHashtag: number;
  };
}

export interface MonthlyReport {
  version: number;
  month: string;
  prevMonth: string;
  /** Newest data day when the report was made ("ข้อมูล ณ วันที่"). */
  dataAt: string;
  createdAt: string;
  createdBy: string;
  online: DigitalKpis;
  onlinePrev: DigitalKpis;
  tv: TvKpis;
  tvPrev: TvKpis;
  platforms: PlatformLine[];
  formats: { vdoType: string; postShare: number; viewShare: number; medianViews: number }[];
  programs: ProgramRow[];
  topClips: ClipRow[];
  topics: TopicRow[];
  overallMedian: number;
  hashtags: { tag: string; posts: number; views: number }[];
  taggedShare: number;
  slots: { day: string; hour: number; medianViews: number; posts: number }[];
  tvChannels: ChannelTv[];
  competitors: CompetitorBlock[];
  recommendations: Recommendation[];
  /** Absent in version 1 reports. */
  deep?: DeepReport;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const within = (rows: RecordRow[], p: MonthPeriod) => rows.filter((r) => r.date >= p.start && r.date <= p.end);
const isTv = (r: RecordRow) => r.platform === "TV" || r.ratingTotal > 0 || r.gmmRating > 0;
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Short number for sentences: 87.9M, 2.9K. */
export const compactNumber = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K` : String(Math.round(v));
const pct = (v: number) => `${Math.round(v * 100)}%`;

function channelTv(channel: "One31" | "GMM25", cur: RecordRow[], prev: RecordRow[]): ChannelTv {
  const rating = (r: RecordRow) => (channel === "One31" ? r.ratingTotal : r.gmmRating);
  const audience = (r: RecordRow) => (channel === "One31" ? r.audienceTotal : r.gmmAudience);
  const rated = cur.filter((r) => rating(r) > 0);
  const ratedPrev = prev.filter((r) => rating(r) > 0);
  const avg = (l: RecordRow[]) => (l.length ? l.reduce((a, r) => a + rating(r), 0) / l.length : null);
  return {
    channel,
    episodes: rated.length,
    avg: avg(rated),
    prevAvg: avg(ratedPrev),
    audience: rated.reduce((a, r) => a + (audience(r) || 0), 0),
    top: [...rated]
      .sort((a, b) => rating(b) - rating(a) || a.date.localeCompare(b.date))
      .slice(0, 5)
      .map((r) => ({ date: r.date, topic: short(r.topic, 120), topicType: r.topicType, rating: rating(r), audience: audience(r) || 0 })),
  };
}

const BRAND = /ถก|tero|เถียง/i;
const MIN_FEATURE_POSTS = 20;
const firstLine = (t: string) => String(t || "").split("\n")[0];

function youtubeGroup(items: ReturnType<typeof joinVideos>): YoutubeGroup {
  const views = items.reduce((a, x) => a + x.v.views, 0);
  const weighted = (f: (v: YtVideo) => number) => (views ? items.reduce((a, x) => a + f(x.v) * x.v.views, 0) / views : 0);
  return {
    videos: items.length,
    views,
    avgViewSec: Math.round(weighted((v) => v.avgViewSec)),
    avgViewPct: Math.round(weighted((v) => v.avgViewPct) * 10) / 10,
    subs: items.reduce((a, x) => a + x.v.subs, 0),
  };
}

/** Short-clip habits (title, length, tags, platforms, hour) against the typical short of the same platform. */
function shortPatterns(online: RecordRow[]): DeepReport["shorts"] {
  const shorts = online.filter((r) => r.platform === "TikTok" || /short|reel/i.test(r.vdoType));
  const platformMedian: Record<string, number> = {};
  for (const p of new Set(shorts.map((r) => r.platform))) platformMedian[p] = median(shorts.filter((r) => r.platform === p).map((r) => r.views)) || 1;
  const index = (r: RecordRow) => r.views / platformMedian[r.platform];
  const key = (t: string) => t.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, "").slice(0, 25);
  const onPlatforms = new Map<string, Set<string>>();
  for (const r of shorts) {
    const k = key(firstLine(r.topic));
    if (k.length >= 10) onPlatforms.set(k, (onPlatforms.get(k) || new Set()).add(r.platform));
  }
  const length = (r: RecordRow) => r.videoLengthSec || (r.durationMin ? r.durationMin * 60 : 0);
  const features: Record<string, (r: RecordRow) => string | null> = {
    "ความยาวคลิป": (r) => { const n = length(r); return !n ? null : n < 30 ? "ไม่ถึง 30 วิ" : n < 60 ? "30–59 วิ" : n < 90 ? "60–89 วิ" : n < 180 ? "90–179 วิ" : "3 นาทีขึ้นไป"; },
    "ชื่อมีเครื่องหมายคำถาม": (r) => (/\?/.test(firstLine(r.topic)) ? "มี ?" : "ไม่มี"),
    "ชื่อมี !": (r) => (/!/.test(firstLine(r.topic)) ? "มี !" : "ไม่มี"),
    "ชื่อยกคำพูด": (r) => (/[“”"]/.test(firstLine(r.topic)) ? "มีคำพูด" : "ไม่มี"),
    "ชื่อมีตัวเลข": (r) => (/\d/.test(firstLine(r.topic)) ? "มีตัวเลข" : "ไม่มี"),
    "จำนวน Hashtag": (r) => { const n = parseHashtags(r.hashtags).length; return n === 0 ? "ไม่มี" : n <= 3 ? "1–3 แท็ก" : n <= 6 ? "4–6 แท็ก" : "7 แท็กขึ้นไป"; },
    "ลงกี่แพลตฟอร์ม": (r) => { const k = key(firstLine(r.topic)); if (k.length < 10) return null; const n = onPlatforms.get(k)?.size || 1; return n >= 3 ? "3 แพลตฟอร์มขึ้นไป" : n === 2 ? "2 แพลตฟอร์ม" : "แพลตฟอร์มเดียว"; },
    "ช่วงเวลาโพสต์": (r) => { if (!r.publishTime || r.publishTime === "00:00") return null; const h = Number(r.publishTime.slice(0, 2)); return h < 9 ? "00–08 น." : h < 12 ? "09–11 น." : h < 15 ? "12–14 น." : h < 18 ? "15–17 น." : h < 21 ? "18–20 น." : "21–23 น."; },
  };
  const out: DeepReport["shorts"]["features"] = [];
  for (const [name, of] of Object.entries(features)) {
    const groups = new Map<string, RecordRow[]>();
    for (const r of shorts) {
      const v = of(r);
      if (v) groups.set(v, [...(groups.get(v) || []), r]);
    }
    const list = [...groups.entries()]
      .filter(([, l]) => l.length >= MIN_FEATURE_POSTS)
      .map(([value, l]) => ({ value, posts: l.length, index: Math.round(median(l.map(index)) * 100) / 100, hitRate: l.filter((r) => index(r) >= 3).length / l.length }))
      .sort((a, b) => b.index - a.index);
    if (list.length >= 2) out.push({ name, groups: list });
  }
  return { posts: shorts.length, features: out };
}

/** Everything for the เชิงลึก pages. `yt` = YouTube Analytics (null when not readable); `gains` = daily gains by day. */
function buildDeep(
  online: RecordRow[],
  period: MonthPeriod,
  yt: YtDeepDiveData | null,
  gains: Map<string, GrowthEntry[] | null> | null,
): DeepReport {
  const youtubeRows = online.filter((r) => r.platform === "YouTube");
  let youtube: DeepReport["youtube"] = null;
  if (yt) {
    const items = joinVideos(yt, youtubeRows);
    const traffic = new Map<string, number>();
    let trafficVideos = 0;
    for (const x of items) {
      if (!x.v.traffic) continue;
      trafficVideos++;
      for (const [src, v] of Object.entries(x.v.traffic)) traffic.set(src, (traffic.get(src) || 0) + v);
    }
    const total = [...traffic.values()].reduce((a, v) => a + v, 0);
    youtube = {
      matched: items.length,
      posts: youtubeRows.length,
      shorts: youtubeGroup(items.filter((x) => formatOf(x.row.vdoType) === "Shorts")),
      long: youtubeGroup(items.filter((x) => formatOf(x.row.vdoType) !== "Shorts")),
      newSubs: items.reduce((a, x) => a + x.v.subs, 0),
      updatedAt: yt.updatedAt,
      traffic: total ? [...traffic.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([source, v]) => ({ source, share: v / total })) : [],
      trafficVideos,
    };
  }

  const engagement = REPORT_PLATFORMS.map((platform) => {
    const list = online.filter((r) => r.platform === platform);
    const k = digitalKpis(list);
    const watch = list.filter((r) => r.avgWatchSec > 0);
    const watchViews = watch.reduce((a, r) => a + r.views, 0);
    const skip = list.filter((r) => r.skipRate !== null && r.skipRate !== undefined);
    return {
      platform,
      posts: list.length,
      sharesPer1k: k.sharesPer1k,
      commentsPer1k: k.commentsPer1k,
      avgWatchSec: watchViews ? Math.round(watch.reduce((a, r) => a + r.avgWatchSec * r.views, 0) / watchViews) : null,
      skipRate: skip.length ? Math.round((skip.reduce((a, r) => a + (r.skipRate as number), 0) / skip.length) * 10) / 10 : null,
    };
  })
    .filter((e) => e.posts > 0)
    .map((e) => ({ platform: e.platform, sharesPer1k: e.sharesPer1k, commentsPer1k: e.commentsPer1k, avgWatchSec: e.avgWatchSec, skipRate: e.skipRate }));

  // Views by the weekday of posting, per calendar day of that weekday in the month (empty days count).
  const calendar = [0, 0, 0, 0, 0, 0, 0];
  const last = Number(period.end.slice(8, 10));
  for (let d = 1; d <= last; d++) calendar[(new Date(Date.UTC(Number(period.month.slice(0, 4)), Number(period.month.slice(5, 7)) - 1, d)).getUTCDay() + 6) % 7]++;
  const weekdays = WEEKDAYS.map((day, i) => {
    const list = online.filter((r) => (new Date(`${r.date}T00:00:00Z`).getUTCDay() + 6) % 7 === i);
    const views = list.reduce((a, r) => a + r.views, 0);
    return { day, posts: list.length, views, avgPerDay: calendar[i] ? views / calendar[i] : 0 };
  });

  let growth: DeepReport["growth"] = null;
  if (gains) {
    const days = [...gains.entries()].filter(([d, e]) => d >= period.start && d <= period.end && e);
    if (days.length) {
      const perDay = days.map(([day, e]) => ({ day, views: (e as GrowthEntry[]).reduce((a, x) => a + (x[1] || 0), 0) })).sort((a, b) => b.views - a.views);
      const totalViews = perDay.reduce((a, d) => a + d.views, 0);
      growth = { days: days.length, of: last, totalViews, perDay: totalViews / days.length, peaks: perDay.slice(0, 3) };
    }
  }

  let seo: DeepReport["seo"] = null;
  const w = yt?.windows?.d28;
  if (yt && w) {
    const windowTotal = w.traffic.reduce((a, t) => a + t.views, 0);
    const search = w.traffic.find((t) => t.source === "YT_SEARCH")?.views || 0;
    const termTotal = w.searchTerms.reduce((a, t) => a + t.views, 0);
    const brandViews = w.searchTerms.filter((t) => BRAND.test(t.term)).reduce((a, t) => a + t.views, 0);
    const titles = youtubeRows.map((r) => firstLine(r.topic));
    seo = {
      range: `${w.start} – ${w.end}`,
      searchShare: windowTotal ? search / windowTotal : null,
      brandShare: termTotal ? brandViews / termTotal : null,
      terms: w.searchTerms.filter((t) => !BRAND.test(t.term)).slice(0, 8),
      gaps: searchGaps(w.searchTerms, titles).slice(0, 6),
      posts: youtubeRows.length,
      titleOver70: titles.filter((t) => t.length > 70).length,
      noHashtag: youtubeRows.filter((r) => !parseHashtags(r.hashtags).length).length,
    };
  }
  return { youtube, engagement, weekdays, growth, shorts: shortPatterns(online), seo };
}

/** Rules over the report's own numbers; each carries the figures it rests on. */
function recommend(r: Omit<MonthlyReport, "recommendations">): Recommendation[] {
  const out: Recommendation[] = [];
  const prevName = monthLabel(r.prevMonth).split(" ")[0];
  const byMedian = r.platforms.filter((p) => p.posts >= 20).sort((a, b) => b.medianViews - a.medianViews);
  if (byMedian.length >= 2) {
    const hi = byMedian[0], lo = byMedian[byMedian.length - 1];
    out.push({
      title: `เพิ่มน้ำหนักให้ ${hi.platform}`,
      because: `วิวต่อโพสต์ (ค่ากลาง) ${compactNumber(hi.medianViews)} สูงกว่า ${lo.platform} (${compactNumber(lo.medianViews)}) ${(hi.medianViews / Math.max(lo.medianViews, 1)).toFixed(1)} เท่า · โพสต์ ${hi.posts.toLocaleString("en-US")} ชิ้น เทียบ ${lo.posts.toLocaleString("en-US")} ชิ้น`,
      action: `นำคลิปที่ได้ผลบน ${lo.platform} มาตัดเป็นเวอร์ชันสำหรับ ${hi.platform} เพิ่ม`,
    });
  }
  const drop = r.platforms.filter((p) => p.growth !== null && p.growth < -0.15).sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))[0];
  if (drop) {
    const morePosts = (drop.postsGrowth ?? 0) >= 0;
    out.push({
      title: `ตรวจสอบ ${drop.platform} ที่วิวลดลง`,
      because: `วิวรวม ${compactNumber(drop.views)} ลดลง ${pct(-(drop.growth ?? 0))} จาก${prevName} ขณะที่จำนวนโพสต์${morePosts ? "เพิ่มขึ้น" : "ลดลง"} ${pct(Math.abs(drop.postsGrowth ?? 0))}`,
      action: morePosts ? "โพสต์มากขึ้นแต่วิวรวมลดลง ควรดูประเด็นและรูปแบบคลิปที่เปลี่ยนไปในหน้า รายงานรายแพลตฟอร์ม" : "จำนวนโพสต์ลดลงด้วย ควรกลับไปลงให้สม่ำเสมอเท่าเดือนก่อน",
    });
  }
  if (r.topics.length >= 2) {
    const best = r.topics[0];
    out.push({ title: `ทำประเด็น "${best.topicType}" ต่อ`, because: `ค่ากลาง ${compactNumber(best.medianViews)} วิวต่อโพสต์ = ${best.index.toFixed(1)} เท่าของค่ากลางทั้งเดือน (${best.posts} โพสต์)`, action: "วางแผนคอนเทนต์ประเด็นนี้เพิ่ม และใช้เป็นแนวเลือกคลิปตัด" });
    const worst = r.topics[r.topics.length - 1];
    if (worst.index < 0.6) out.push({ title: `ทบทวนประเด็น "${worst.topicType}"`, because: `ค่ากลาง ${compactNumber(worst.medianViews)} วิวต่อโพสต์ = ${worst.index.toFixed(1)} เท่าของค่ากลางทั้งเดือน (${worst.posts} โพสต์)`, action: "ลดจำนวน หรือเปลี่ยนวิธีเล่า เช่น ปกและพาดหัวที่ชัดขึ้น" });
  }
  const slot = r.slots[0];
  if (slot) out.push({ title: `ช่วงเวลาโพสต์ที่ได้ผลดี: ${slot.day} ${String(slot.hour).padStart(2, "0")}:00`, because: `ค่ากลาง ${compactNumber(slot.medianViews)} วิวต่อโพสต์ (${slot.posts} โพสต์) เทียบค่ากลางทั้งเดือน ${compactNumber(r.overallMedian)}`, action: "จัดคลิปเด่นของสัปดาห์ไว้ช่วงเวลานี้" });
  const one31 = r.tvChannels.find((c) => c.channel === "One31");
  if (one31?.avg && one31.prevAvg && one31.top[0]) {
    const diff = (one31.avg - one31.prevAvg) / one31.prevAvg;
    if (Math.abs(diff) >= 0.05) out.push({ title: `TV One31 ${diff > 0 ? "เรตติ้งขึ้น" : "เรตติ้งลดลง"}`, because: `เฉลี่ย ${one31.avg.toFixed(3)} จาก ${one31.prevAvg.toFixed(3)} (${diff > 0 ? "+" : ""}${pct(diff)}) · เทปสูงสุด ${one31.top[0].rating.toFixed(3)} ประเด็น "${short(one31.top[0].topic, 50)}"`, action: "ดูประเด็นของเทปที่เรตติ้งสูงสุด แล้ววางแผนประเด็นแนวเดียวกัน" });
  }
  const programs = r.programs.filter((p) => p.program !== "อื่นๆ" && !p.program.startsWith("ไม่ระบุ") && p.growth !== null && p.posts >= 10);
  const up = [...programs].sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  if (up && (up.growth ?? 0) > 0.2) out.push({ title: `รายการ "${up.program}" กำลังโต`, because: `วิว ${compactNumber(up.views)} เพิ่มขึ้น ${pct(up.growth ?? 0)} จาก${prevName} (${up.posts} โพสต์)`, action: "เพิ่มจำนวนคลิปของรายการนี้ และโปรโมตข้ามแพลตฟอร์ม" });
  if (r.taggedShare < 0.6) out.push({ title: "ใส่ Hashtag ให้ครบ", because: `มีเพียง ${pct(r.taggedShare)} ของโพสต์ที่มี Hashtag`, action: "ใส่ 2–3 แท็กของรายการและประเด็นทุกโพสต์ เพื่อให้ค้นหาและวัดผลได้" });
  const d = r.deep;
  if (d) {
    // Short-clip habits that did best (at least 1.15x the typical short) among the ones people can change.
    const wanted = ["ความยาวคลิป", "ชื่อยกคำพูด", "จำนวน Hashtag", "ลงกี่แพลตฟอร์ม", "ช่วงเวลาโพสต์"];
    const best: { name: string; g: FeatureGroup }[] = [];
    for (const name of wanted) {
      const g = d.shorts.features.find((f) => f.name === name)?.groups[0];
      if (g && g.index >= 1.15 && g.value !== "ไม่มี") best.push({ name, g });
    }
    if (best.length >= 2) out.push({ title: "สูตรคลิปสั้นที่ได้ผลกว่าปกติ", because: best.map((x) => `${x.g.value} (${x.g.index.toFixed(2)}×)`).join(" · "), action: "ใช้เป็นแนวทดลองกับคลิปสั้นเดือนหน้า · เป็นความสัมพันธ์จากข้อมูล ไม่ใช่เหตุผลที่แน่ชัด" });
    const yt = d.youtube;
    if (yt && yt.long.videos >= 5 && yt.long.avgViewPct < 35) out.push({ title: "คลิปยาวเปิดเรื่องให้เร็ว", because: `คนดูคลิปยาวเฉลี่ยเพียง ${yt.long.avgViewPct}% ของความยาว (${yt.long.videos} คลิป)`, action: "ย้ายประเด็นหลักมาไว้ช่วงต้นคลิป และตัดช่วงเกริ่นที่ยาว" });
    const ig = d.engagement.find((e) => e.platform === "Instagram");
    if (ig && ig.skipRate !== null && ig.skipRate >= 40) out.push({ title: "คลิป Instagram ดึงคนใน 1–2 วินาทีแรก", because: `${ig.skipRate}% ของคนกดข้ามตั้งแต่ต้นคลิป`, action: "เปิดคลิปด้วยประเด็นหรือภาพที่แรงที่สุดทันที" });
    const avg = (list: { avgPerDay: number }[]) => (list.length ? list.reduce((a, x) => a + x.avgPerDay, 0) / list.length : 0);
    const weekday = avg(d.weekdays.slice(0, 5));
    const weekend = avg(d.weekdays.slice(5));
    if (weekday > 0 && weekend < weekday * 0.15) out.push({ title: "ตั้งเวลาโพสต์วันเสาร์–อาทิตย์", because: `วิวเฉลี่ยต่อวันที่โพสต์เสาร์–อาทิตย์ ${compactNumber(weekend)} เทียบวันธรรมดา ${compactNumber(weekday)}`, action: "ตั้งเวลาโพสต์ล่วงหน้า เพื่อไม่ให้ช่วงสุดสัปดาห์ว่าง" });
    const seo = d.seo;
    if (seo && seo.posts && (seo.titleOver70 / seo.posts > 0.5 || (seo.searchShare !== null && seo.searchShare < 0.05))) {
      out.push({ title: "ปรับชื่อคลิป YouTube ให้ค้นหาเจอ", because: `ชื่อยาวเกิน 70 ตัวอักษร ${pct(seo.titleOver70 / seo.posts)} ของคลิป${seo.searchShare !== null ? ` · วิวจากการค้นหาเพียง ${pct(seo.searchShare)}` : ""}`, action: "ใส่ชื่อคน/เรื่องไว้ต้นชื่อ ความยาวไม่เกิน 70 ตัวอักษร" });
    }
  }
  return out.slice(0, 10);
}

/**
 * The report for `month` from the dashboard rows (normalised, all dates) and
 * the TV competitor sources. `meta`: who made it and the newest data day.
 */
export function buildMonthlyReport(
  rows: RecordRow[],
  month: string,
  competitorSources: { channel: string; program: string; rows: CompetitorRow[] }[],
  meta: { createdAt: string; createdBy: string; dataAt: string },
  extras: { yt?: YtDeepDiveData | null; gains?: Map<string, GrowthEntry[] | null> | null } = {},
): MonthlyReport {
  const cur = monthPeriod(month);
  const prev = monthPeriod(previousMonth(month));
  const now = within(rows, cur);
  const before = within(rows, prev);
  const online = now.filter((r) => !isTv(r));
  const onlinePrev = before.filter((r) => !isTv(r));
  const tvNow = now.filter(isTv);
  const tvBefore = before.filter(isTv);
  const k = digitalKpis(online);
  const kp = digitalKpis(onlinePrev);

  const platforms: PlatformLine[] = REPORT_PLATFORMS.map((platform) => {
    const a = digitalKpis(online.filter((r) => r.platform === platform));
    const b = digitalKpis(onlinePrev.filter((r) => r.platform === platform));
    return { platform, views: a.views, share: k.views ? a.views / k.views : 0, growth: change(a.views, b.views), posts: a.posts, postsGrowth: change(a.posts, b.posts), medianViews: a.medianViews ?? 0, er: a.er };
  })
    .filter((p) => p.posts > 0)
    .sort((a, b) => b.views - a.views);

  const table = programTable(rows, cur, prev);
  const programs: ProgramRow[] = table.lines.slice(0, 10).map((l) => ({ program: l.program, views: l.views, share: l.share, growth: l.growth, posts: l.posts, medianViews: l.medianViews, tvEpisodes: l.tv.episodes, tvRating: l.tv.rating }));

  const overallMedian = median(online.map((r) => r.views));
  const byTopic = new Map<string, number[]>();
  for (const r of online) {
    const t = r.topicType || "ไม่ระบุประเภท";
    const l = byTopic.get(t);
    if (l) l.push(r.views);
    else byTopic.set(t, [r.views]);
  }
  const topics = [...byTopic.entries()]
    .filter(([t, v]) => v.length >= MIN_TOPIC_POSTS && !t.startsWith("ไม่ระบุ"))
    .map(([topicType, v]) => ({ topicType, posts: v.length, medianViews: median(v), index: overallMedian ? median(v) / overallMedian : 0 }))
    .sort((a, b) => b.medianViews - a.medianViews)
    .slice(0, 8);

  const heat = postingHeatmap(online);
  const slots: MonthlyReport["slots"] = [];
  heat.cells.forEach((dayRow, day) =>
    dayRow.forEach((c, hour) => {
      if (c.posts >= MIN_SLOT_POSTS && c.medianViews !== null) slots.push({ day: WEEKDAYS[day], hour, medianViews: c.medianViews, posts: c.posts });
    }),
  );
  slots.sort((a, b) => b.medianViews - a.medianViews);

  const trend = trendingHashtags(online, cur, prev);

  const competitors: CompetitorBlock[] = [];
  for (const s of [...competitorSources].sort((a, b) => Number(/gmm/i.test(a.channel)) - Number(/gmm/i.test(b.channel)))) {
    const gmm = /gmm/i.test(s.channel);
    const own = new Map<string, number>();
    for (const r of tvNow) {
      if (r.program !== s.program) continue;
      const v = gmm ? r.gmmRating : r.ratingTotal;
      if (v > 0) own.set(r.date, v);
    }
    for (const mode of ["channel", "slot"] as CompetitorMode[]) {
      const ranking = competitorRanking(s.rows, own, mode, cur.start, cur.end);
      if (ranking.some((x) => !x.own)) competitors.push({ channel: gmm ? "GMM25" : "One31", program: s.program, mode, ranking });
    }
  }

  const deep = buildDeep(online, cur, extras.yt ?? null, extras.gains ?? null);
  const base: Omit<MonthlyReport, "recommendations"> = {
    version: REPORT_VERSION,
    month,
    prevMonth: prev.month,
    ...meta,
    online: k,
    onlinePrev: kp,
    tv: tvKpis(tvNow),
    tvPrev: tvKpis(tvBefore),
    platforms,
    formats: formatMix(online).slice(0, 5).map((f) => ({ vdoType: f.vdoType, postShare: f.postShare, viewShare: f.viewShare, medianViews: f.medianViews ?? 0 })),
    programs,
    topClips: [...online].sort((a, b) => b.views - a.views).slice(0, 5).map((r) => ({ topic: short(r.topic, 120), platform: r.platform, program: r.program, date: r.date, views: r.views, url: r.url })),
    topics,
    overallMedian,
    hashtags: trend.items.slice(0, 8).map((t) => ({ tag: t.tag, posts: t.posts, views: t.views })),
    taggedShare: online.length ? online.filter((r) => r.hashtags).length / online.length : 0,
    slots: slots.slice(0, 3),
    tvChannels: [channelTv("One31", tvNow, tvBefore), channelTv("GMM25", tvNow, tvBefore)].filter((c) => c.episodes > 0),
    competitors,
    deep,
  };
  return { ...base, recommendations: recommend(base) };
}
