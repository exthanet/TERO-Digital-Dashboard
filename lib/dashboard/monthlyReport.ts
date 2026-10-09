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

export const REPORT_VERSION = 1;
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
  return out.slice(0, 7);
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
  };
  return { ...base, recommendations: recommend(base) };
}
