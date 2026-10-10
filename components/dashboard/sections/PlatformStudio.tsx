"use client";
// วิเคราะห์เชิงลึก → รายงานรวมแพลตฟอร์ม: the top of each platform's page, in the
// look of that platform's own analytics (YouTube Studio, TikTok Studio, Meta
// Business Suite, Instagram, TV ratings). Numbers from lib/dashboard/platformStudio.ts.
// Only boxes the data can fill: no follower-online times, reactions or TikTok traffic
// sources, which the APIs do not give us. YouTube Analytics boxes need Deep Dive.
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { TOPIC_COLORS } from "@/lib/dashboard/constants";
import { change, digitalKpis } from "@/lib/dashboard/platformReport";
import {
  dailySeries,
  episodeRatings,
  groupStats,
  hourMedians,
  ownRatings,
  sourceOf,
  interactionMix,
  lastDays,
  reachRings,
  recentGains,
  skipStats,
  topPosts,
  ytStudio,
  zoneRatings,
  type DayPoint,
  type TvChannel,
} from "@/lib/dashboard/platformStudio";
import { recordKey } from "@/lib/dashboard/growth";
import { TRAFFIC_LABEL } from "@/lib/dashboard/ytDeepDive";
import { OWN_KEY, competitorRanking } from "@/lib/dashboard/competitors";
import { loadYtAnalytics } from "@/lib/ytAnalyticsData";
import { loadGrowthDays } from "@/lib/growthData";
import { loadThumbnails, thumbnailFor } from "@/lib/thumbnailData";
import { loadTvCompetitors, type CompetitorSource } from "@/lib/tvCompetitorData";
import { track } from "@/lib/loadingBar";
import { Growth } from "@/components/dashboard/shared/Growth";
import { CountUp, Skeleton, useMotion } from "@/components/dashboard/shared/Motion";
import type { GrowthEntry } from "@/lib/dashboard/growth";
import type { YtDeepDiveData } from "@/lib/dashboard/ytDeepDive";

type Digital = "YouTube" | "TikTok" | "Facebook" | "Instagram";
type Metric = "views" | "hours" | "subs" | "posts" | "medianViews" | "er" | "sharesPer1k" | "commentsPer1k" | "likes" | "comments" | "shares" | "engagement" | "impressions" | "linkClicks";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const shortDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const fullDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const fixed = (d: number) => (v: number) => v.toFixed(d);

const METRICS: Record<Metric, { label: string; format: (v: number) => string; detail: string }> = {
  views: { label: "ยอดดู", format: compact, detail: "วิวรวมของโพสต์ที่ลงในช่วงนี้" },
  hours: { label: "เวลาในการรับชม (ชั่วโมง)", format: compact, detail: "จาก YouTube Analytics ตั้งแต่ลงคลิป" },
  subs: { label: "ผู้ติดตามที่ได้", format: num, detail: "จาก YouTube Analytics ตั้งแต่ลงคลิป" },
  posts: { label: "จำนวนโพสต์", format: num, detail: "โพสต์ที่ลงในช่วงนี้" },
  medianViews: { label: "วิวต่อโพสต์ (ค่ากลาง)", format: compact, detail: "ครึ่งหนึ่งของโพสต์ได้วิวมากกว่านี้" },
  er: { label: "ER", format: (v) => pct(v, 2), detail: "(Like + Comment + Share) ÷ วิว" },
  sharesPer1k: { label: "Share ต่อ 1,000 วิว", format: fixed(2), detail: "คนแชร์ต่อไปมากแค่ไหน" },
  commentsPer1k: { label: "Comment ต่อ 1,000 วิว", format: fixed(2), detail: "คนอยากพูดถึงมากแค่ไหน" },
  likes: { label: "ไลก์", format: compact, detail: "ไลก์รวมของโพสต์ที่ลงในช่วงนี้" },
  comments: { label: "คอมเมนต์", format: compact, detail: "คอมเมนต์รวมของโพสต์ที่ลงในช่วงนี้" },
  shares: { label: "แชร์", format: compact, detail: "แชร์รวมของโพสต์ที่ลงในช่วงนี้" },
  engagement: { label: "การมีส่วนร่วม", format: compact, detail: "Like + Comment + Share" },
  impressions: { label: "การเข้าถึง", format: compact, detail: "Impressions ของโพสต์ที่ Facebook ส่งมา" },
  linkClicks: { label: "คลิกลิงก์", format: compact, detail: "คลิกลิงก์ของโพสต์ที่ Facebook ส่งมา" },
};
const TILES: Record<Digital, Metric[]> = {
  // As in output/platform-report-demo.html; per-post rates are in Platform Insight.
  YouTube: ["views", "hours", "subs"],
  TikTok: ["views", "likes", "comments", "shares"],
  Facebook: ["views", "impressions", "engagement", "linkClicks"],
  Instagram: ["views", "engagement", "posts"],
};
const SKIN: Record<Digital, { cls: string; accent: string; grid: string; text: string }> = {
  YouTube: { cls: "ps-yt", accent: "#cc0000", grid: "#e5e5e5", text: "#606060" },
  TikTok: { cls: "ps-tk", accent: "#fe2c55", grid: "#2e2e2e", text: "#a1a1a1" },
  Facebook: { cls: "ps-fb", accent: "#1877f2", grid: "#e4e6eb", text: "#65676b" },
  Instagram: { cls: "ps-ig", accent: "#dd2a7b", grid: "#efefef", text: "#737373" },
};

interface Props {
  platform: Digital;
  /** The platform's rows in the range / the comparison range. */
  cur: RecordRow[];
  prev: RecordRow[];
  /** The platform's rows passing the filters, every date (whose gains count in "last 7 days"). */
  mine: RecordRow[];
  startDate: string;
  endDate: string;
  latestDate: string;
  compareText: string;
  canDeepDive: boolean;
  onOpen: (r: RecordRow) => void;
}

/** Cover of a post: YouTube from the id, others from the stored links; a gradient when there is none. */
function Cover({ row, stored, className }: { row: RecordRow; stored: Map<string, string>; className: string }) {
  const src = thumbnailFor(recordKey(row), stored);
  const [broken, setBroken] = useState("");
  return (
    <span className={`ps-cover ${className}`}>
      {src && broken !== src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(src)} />}
    </span>
  );
}

function useThumbs(on: boolean) {
  const [stored, setStored] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!on) return;
    let alive = true;
    track(loadThumbnails())
      .then((m) => alive && setStored(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [on]);
  return stored;
}

function MainChart({ data, metric, color, grid, text, studio = false }: { data: DayPoint[]; metric: Metric; color: string; grid: string; text: string; studio?: boolean }) {
  const motion = useMotion();
  const f = METRICS[metric].format;
  const ends = data.length > 1 ? [data[0].date, data[data.length - 1].date] : undefined;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`ps-fill-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={studio ? 0.5 : 0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: text }} stroke={grid} minTickGap={24} ticks={studio ? ends : undefined} />
        <YAxis tickFormatter={(v: number) => f(v)} tick={{ fontSize: 11, fill: text }} stroke={studio ? "none" : grid} width={56} tickCount={studio ? 3 : undefined} />
        <Tooltip
          labelFormatter={(d) => fullDate(String(d))}
          formatter={(v, _n, p) => [`${v === null || v === undefined ? "-" : f(Number(v))} · ${num((p?.payload as DayPoint)?.posts || 0)} โพสต์`, METRICS[metric].label]}
        />
        <Area type={studio ? "linear" : "monotone"} dataKey={metric} stroke={color} strokeWidth={2} fill={`url(#ps-fill-${color.slice(1)})`} isAnimationActive={motion} animationDuration={700} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Bars({ items, color, format = pct }: { items: { label: string; value: number; note?: string }[]; color: string; format?: (v: number) => string }) {
  const max = Math.max(0, ...items.map((x) => x.value));
  return (
    <div className="ps-bars">
      {items.map((x) => (
        <div key={x.label} className="ps-bar" title={x.note}>
          <span className="ps-bar-label">{x.label}</span>
          <span className="ps-bar-track">
            <span style={{ width: max ? `${(x.value / max) * 100}%` : 0, background: color }} />
          </span>
          <b>{format(x.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Ring({ value, label, color, track: trackColor }: { value: number; label: string; color: string; track: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ps-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${label} ${pct(value)}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke={trackColor} strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 60 60)" className="ps-ring-arc" />
        <text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">
          {pct(value, value < 0.1 ? 1 : 0)}
        </text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

function PostRow({ row, stored, i, onOpen, extra }: { row: RecordRow; stored: Map<string, string>; i: number; onOpen: (r: RecordRow) => void; extra?: string }) {
  return (
    <button type="button" className="ps-post-row" onClick={() => onOpen(row)} title="วิเคราะห์คลิปนี้">
      <b className="ps-rank">{i + 1}</b>
      <Cover row={row} stored={stored} className={/short|reel|tiktok/i.test(row.vdoType) ? "tall" : "wide"} />
      <span className="ps-post-title">
        {row.topic || "ไม่ระบุประเด็น"}
        <small>
          {row.vdoType} · {fullDate(row.date)}
          {extra ? ` · ${extra}` : ""}
        </small>
      </span>
      <strong>{compact(row.views)}</strong>
    </button>
  );
}

function PostTiles({ rows, stored, onOpen }: { rows: RecordRow[]; stored: Map<string, string>; onOpen: (r: RecordRow) => void }) {
  return (
    <div className="ps-tall-grid">
      {rows.map((r, i) => (
        <button type="button" key={`${r.url || r.contentId}-${i}`} className="ps-tall" onClick={() => onOpen(r)} title={r.topic || "วิเคราะห์คลิปนี้"}>
          <Cover row={r} stored={stored} className="fill" />
          <em>{r.topic || "ไม่ระบุประเด็น"}</em>
          <span>▶ {compact(r.views)}</span>
        </button>
      ))}
    </div>
  );
}

export function PlatformStudio({ platform, cur, prev, mine, startDate, endDate, latestDate, compareText, canDeepDive, onOpen }: Props) {
  const skin = SKIN[platform];
  const isYt = platform === "YouTube";
  const deepOn = isYt && canDeepDive;
  const [metricPick, setMetric] = useState<Metric>("views");
  const stored = useThumbs(!isYt);

  // YouTube Analytics (Deep Dive) and the last 7 days of growth: YouTube only.
  const [deep, setDeep] = useState<YtDeepDiveData | null | "error" | undefined>(undefined);
  useEffect(() => {
    if (!deepOn) return;
    let alive = true;
    track(loadYtAnalytics())
      .then((d) => alive && setDeep(d))
      .catch(() => alive && setDeep("error"));
    return () => {
      alive = false;
    };
  }, [deepOn]);
  const days7 = useMemo(() => lastDays(latestDate, 7), [latestDate]);
  const [growth, setGrowth] = useState<{ key: string; days: Map<string, GrowthEntry[] | null> } | null>(null);
  const growthKey = days7.join(",");
  useEffect(() => {
    if (!isYt || !days7.length) return;
    let alive = true;
    track(loadGrowthDays(days7))
      .then((days) => alive && setGrowth({ key: growthKey, days }))
      .catch(() => alive && setGrowth({ key: growthKey, days: new Map() }));
    return () => {
      alive = false;
    };
  }, [isYt, days7, growthKey]);

  const deepData = deepOn && deep && deep !== "error" ? deep : null;
  const yt = useMemo(() => (deepData ? ytStudio(deepData, cur) : null), [deepData, cur]);
  const ytPrev = useMemo(() => (deepData && prev.length ? ytStudio(deepData, prev) : null), [deepData, prev]);
  const series = useMemo(() => dailySeries(cur, startDate, endDate, yt?.byKey), [cur, startDate, endDate, yt]);
  const k = useMemo(() => digitalKpis(cur), [cur]);
  const kp = useMemo(() => (prev.length ? digitalKpis(prev) : null), [prev]);

  const tiles = TILES[platform].filter((m) => (m === "hours" || m === "subs" ? deepOn : true));
  const metric: Metric = tiles.includes(metricPick) ? metricPick : "views";
  const valueOf = (m: Metric, rows: RecordRow[] | null, kk: typeof k | null, y: typeof yt): number | null => {
    if (m === "hours") return y ? y.hours : null;
    if (m === "subs") return y ? y.subs : null;
    if (!rows || !kk) return null;
    const sum = (f: (r: RecordRow) => number) => rows.reduce((a, r) => a + f(r), 0);
    if (m === "likes") return sum((r) => r.likes);
    if (m === "comments") return sum((r) => r.comments);
    if (m === "shares") return sum((r) => r.shares);
    if (m === "engagement") return sum((r) => r.likes + r.comments + r.shares);
    if (m === "impressions") return sum((r) => r.impressions || 0);
    if (m === "linkClicks") return sum((r) => r.linkClicks || 0);
    return m === "posts" ? kk.posts : (kk[m] as number | null);
  };

  const gains = useMemo(() => {
    if (!isYt || !growth || growth.key !== growthKey) return null;
    const keys = new Set(mine.map(recordKey).filter(Boolean));
    return recentGains(growth.days, keys, days7);
  }, [isYt, growth, growthKey, mine, days7]);
  const rowByKey = useMemo(() => new Map(mine.map((r) => [recordKey(r), r])), [mine]);

  const top = useMemo(() => topPosts(cur, 8), [cur]);
  const topics = useMemo(() => (platform === "TikTok" ? groupStats(cur, (r) => r.topicType).slice(0, 8) : []), [cur, platform]);
  const rings = useMemo(() => reachRings(cur), [cur]);
  const hours = useMemo(() => (platform === "TikTok" ? hourMedians(cur) : []), [cur, platform]);
  // The four hours with the highest median, in TikTok pink; the rest grey (as the demo).
  const bestHours = useMemo(() => new Set([...hours].filter((h) => h.medianViews !== null).sort((a, b) => (b.medianViews || 0) - (a.medianViews || 0)).slice(0, 4).map((h) => h.hour)), [hours]);
  const types = useMemo(() => (platform === "Facebook" || platform === "Instagram" ? groupStats(cur, (r) => r.vdoType) : []), [cur, platform]);
  const mix = useMemo(() => interactionMix(cur), [cur]);
  const fb = useMemo(() => {
    const reels = types.filter((t) => /reel/i.test(t.key));
    const others = types.filter((t) => !/reel/i.test(t.key));
    const items = [
      { k: "Like", v: mix.total ? mix.likes / mix.total : 0, c: "#1877f2" },
      { k: "Share", v: mix.total ? mix.shares / mix.total : 0, c: "#42b72a" },
      { k: "Comment", v: mix.total ? mix.comments / mix.total : 0, c: "#f7b928" },
    ].sort((x, y) => y.v - x.v);
    return {
      reelShare: reels.reduce((a, t) => a + t.viewShare, 0),
      postShare: others.reduce((a, t) => a + t.viewShare, 0),
      reels: reels.reduce((a, t) => a + t.posts, 0),
      posts: others.reduce((a, t) => a + t.posts, 0),
      mix: items,
      mixMax: Math.max(0, ...items.map((x) => x.v)),
    };
  }, [types, mix]);
  const reels = useMemo(() => cur.filter((r) => /reel/i.test(r.vdoType)), [cur]);
  const skip = useMemo(() => (platform === "Instagram" ? skipStats(reels) : null), [reels, platform]);
  const igEngagement = [
    { k: "แชร์", v: k.sharesPer1k, c: "#dd2a7b" },
    { k: "คอมเมนต์", v: k.commentsPer1k, c: "#f58529" },
    { k: "ไลก์", v: k.views > 0 ? (cur.reduce((x, r) => x + r.likes, 0) / k.views) * 1000 : 0, c: "#c13584" },
  ];
  const igMax = Math.max(0, ...igEngagement.map((x) => x.v));
  const motion = useMotion();

  const tileRow = (
    <div className={`ps-tiles n${tiles.length}`}>
      {tiles.map((m) => {
        const now = valueOf(m, cur, k, yt);
        const before = kp ? valueOf(m, prev, kp, ytPrev) : null;
        return (
          <button type="button" key={m} className={`ps-tile${platform === "Instagram" ? " static" : metric === m ? " on" : ""}`} onClick={() => setMetric(m)} disabled={platform === "Instagram"} aria-pressed={platform === "Instagram" ? undefined : metric === m} title={METRICS[m].detail}>
            <small>{METRICS[m].label}</small>
            <b>{now === null ? (m === "hours" || m === "subs") && deep === undefined ? "…" : "-" : <CountUp value={now} format={METRICS[m].format} />}</b>
            <Growth value={change(now, before)} title={compareText} />
          </button>
        );
      })}
    </div>
  );
  const chart = (
    <div className="ps-card ps-chart">
      <h3>{METRICS[metric].label} รายวัน</h3>
      <p className="ps-muted">ตามวันที่ลงโพสต์ · กดการ์ดด้านบนเพื่อเปลี่ยนตัวเลข</p>
      <MainChart data={series} metric={metric} color={skin.accent} grid={skin.grid} text={skin.text} />
    </div>
  );

  return (
    <section className={`ps ${skin.cls}`} aria-label={`${platform} board`}>
      {tileRow}

      {isYt && (
        <>
          <div className="ps-grid g2">
            {chart}
            <div className="ps-card">
              <h3>ยอดเพิ่ม 7 วันล่าสุด</h3>
              <p className="ps-muted">วิวที่โพสต์ทั้งหมดของ YouTube (ตามตัวกรอง) ได้เพิ่มในแต่ละวัน · ถึง {fullDate(latestDate)}</p>
              {!gains ? (
                <Skeleton lines={3} height={70} />
              ) : (
                <>
                  <b className="ps-big">
                    <CountUp value={gains.total} format={compact} />
                  </b>
                  <span className="ps-muted">ยอดดู</span>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={gains.series} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: skin.text }} stroke={skin.grid} interval={0} />
                      <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, _n, p) => [(p?.payload as { missing: boolean })?.missing ? "ยังไม่มีข้อมูล" : compact(Number(v)), "วิวที่เพิ่ม"]} />
                      <Bar dataKey="views" fill={skin.accent} radius={[3, 3, 0, 0]} isAnimationActive={motion} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ol className="ps-mini-list">
                    {gains.top.map((x) => {
                      const r = rowByKey.get(x.key);
                      return (
                        <li key={x.key}>
                          {r ? (
                            <button type="button" className="clip-open" onClick={() => onOpen(r)}>
                              {r.topic || "ไม่ระบุประเด็น"}
                            </button>
                          ) : (
                            <span>คลิปนอกตัวกรอง</span>
                          )}
                          <b>+{compact(x.views)}</b>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          </div>
          <div className={`ps-grid ${deepOn ? "g11" : ""}`}>
            <div className="ps-card">
              <h3>เนื้อหายอดนิยม</h3>
              <p className="ps-muted">วิวสูงสุดในช่วงนี้ · กดเพื่อวิเคราะห์คลิป</p>
              {top.map((r, i) => (
                <PostRow key={`${r.url || r.contentId}-${i}`} row={r} stored={stored} i={i} onOpen={onOpen} />
              ))}
            </div>
            {deepOn && (
              <div className="ps-card">
                <h3>
                  การดูต่อของผู้ชม <span className="ps-muted">(คลิปวิวสูงสุดที่มีกราฟ)</span>
                </h3>
                {deep === undefined ? (
                  <Skeleton lines={1} height={150} />
                ) : yt?.retention ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={yt.retention.points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={skin.grid} vertical={false} />
                        <XAxis dataKey="at" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: skin.text }} stroke={skin.grid} />
                        <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: skin.text }} stroke={skin.grid} width={40} />
                        <Tooltip labelFormatter={(v) => `ช่วง ${Math.round(Number(v) * 100)}% ของคลิป`} formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "ยังดูอยู่"]} />
                        <Line type="monotone" dataKey="watch" stroke={skin.accent} strokeWidth={2} dot={false} isAnimationActive={motion} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="ps-muted">{yt.retention.title}</p>
                  </>
                ) : (
                  <p className="ps-muted">ยังไม่มีกราฟการดูต่อของคลิปในช่วงนี้ (YouTube ส่งมาเฉพาะคลิปที่คนดูมากที่สุด)</p>
                )}
                <h3 className="ps-gap">แหล่งที่มาของการเข้าชม</h3>
                {deep === undefined ? (
                  <Skeleton lines={4} height={0} />
                ) : yt?.traffic.length ? (
                  <Bars items={yt.traffic.slice(0, 6).map((t) => ({ label: TRAFFIC_LABEL[t.source] || t.source, value: t.share, note: `${num(t.views)} วิว` }))} color={skin.accent} />
                ) : (
                  <p className="ps-muted">ยังไม่มีข้อมูลแหล่งที่มาของคลิปในช่วงนี้</p>
                )}
                <p className="ps-muted ps-gap">
                  YouTube Analytics ตั้งแต่ลงคลิป · ตรงกับ {num(yt?.matched || 0)} จาก {num(cur.length)} คลิปในช่วงนี้
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {platform === "TikTok" && (
        <>
          <div className="ps-grid g2">
            <div className="ps-card ps-chart">
              <MainChart data={series} metric={metric} color={skin.accent} grid={skin.grid} text={skin.text} studio />
            </div>
            <div className="ps-card">
              <h3>ยอดดูตามประเภทเนื้อหา</h3>
              <p className="ps-muted">TikTok ไม่ส่งแหล่งที่มาของยอดดู (For You / ค้นหา) มา</p>
              <div className="pt-donut tk">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={topics} dataKey="views" nameKey="key" innerRadius={78} outerRadius={108} paddingAngle={2} stroke="none" isAnimationActive={motion} startAngle={90} endAngle={-270}>
                    {topics.map((t, i) => (
                      <Cell key={t.key} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${compact(Number(v))} วิว`, String(n)]} />
                </PieChart>
              </ResponsiveContainer>
                {topics[0] && (
                  <div className="pt-donut-mid">
                    <b>{pct(topics[0].viewShare, 0)}</b>
                    <small>{topics[0].key}</small>
                  </div>
                )}
              </div>
              <ul className="ps-legend">
                {topics.map((t, i) => (
                  <li key={t.key}>
                    <i style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                    {t.key} <b>{pct(t.viewShare, 0)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="ps-grid g11">
            <div className="ps-card">
              <h3>โพสต์ยอดนิยม</h3>
              <PostTiles rows={top.slice(0, 4)} stored={stored} onOpen={onOpen} />
            </div>
            <div className="ps-card">
              <h3>การมีส่วนร่วม</h3>
              <p className="ps-muted">TikTok ไม่ส่งยอดดูจนจบ / ผู้ชมใหม่มา</p>
              <div className="ps-rings">
                <Ring value={rings.er} label="ER" color={skin.accent} track={skin.grid} />
                <Ring value={rings.sharedPosts} label="โพสต์ที่มีคนแชร์" color="#25f4ee" track={skin.grid} />
                <Ring value={rings.commentedPosts} label="โพสต์ที่มีคอมเมนต์" color="#ffffff" track={skin.grid} />
              </div>
              <h3 className="ps-gap">ชั่วโมงที่โพสต์แล้วได้วิว</h3>
              <p className="ps-muted">ค่ากลางวิวต่อโพสต์ตามชั่วโมงที่ลง (อย่างน้อย 3 โพสต์) · TikTok ไม่ส่งเวลาที่ผู้ติดตามออนไลน์มา</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={hours} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: skin.text }} stroke="none" interval={0} tickFormatter={(h: number) => (h % 3 ? "" : String(h))} />
                  <Tooltip
                    cursor={{ fill: "#ffffff14" }}
                    labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 น.`}
                    formatter={(v, _n, p) => [v === null || v === undefined ? `${(p?.payload as { posts: number })?.posts || 0} โพสต์ น้อยเกินไป` : `${compact(Number(v))} วิว/โพสต์`, "ค่ากลาง"]}
                  />
                  <Bar dataKey="medianViews" radius={[3, 3, 0, 0]} isAnimationActive={motion}>
                    {hours.map((h) => (
                      <Cell key={h.hour} fill={bestHours.has(h.hour) ? skin.accent : "#3a3a3a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {platform === "Facebook" && (
        <>
          <div className="ps-grid g2">
            <div className="ps-card ps-chart">
              <h3>{METRICS[metric].label}</h3>
              <MainChart data={series} metric={metric} color={skin.accent} grid={skin.grid} text={skin.text} studio />
            </div>
            <div className="ps-card">
              <h3>Reels เทียบโพสต์ปกติ</h3>
              <div className="fb-split">
                <span style={{ width: `${fb.reelShare * 100}%`, background: "#1877f2" }} />
                <span style={{ width: `${fb.postShare * 100}%`, background: "#a6c8ff" }} />
              </div>
              <div className="pi-legend static fb-legend">
                <span>
                  <i style={{ background: "#1877f2" }} />
                  Reels {pct(fb.reelShare, 0)} ของยอดดู ({num(fb.reels)} คลิป)
                </span>
                <span>
                  <i style={{ background: "#a6c8ff" }} />
                  โพสต์ปกติ {pct(fb.postShare, 0)} ({num(fb.posts)} โพสต์)
                </span>
              </div>
              <h3 className="ps-gap">การมีส่วนร่วมแยกประเภท</h3>
              <p className="ps-muted">Facebook ส่งมาเฉพาะยอด Like รวม ไม่แยกอีโมจิ</p>
              {fb.mix.map((x) => (
                <div key={x.k} className="fb-react">
                  <span>{x.k}</span>
                  <div>
                    <span style={{ width: `${fb.mixMax ? (x.v / fb.mixMax) * 100 : 0}%`, background: x.c }} />
                  </div>
                  <b>{pct(x.v, 0)}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="ps-card">
            <h3>โพสต์ยอดนิยม</h3>
            <div className="fb-row fb-th">
              <span>โพสต์</span>
              <span className="n">ยอดดู</span>
              <span className="n">มีส่วนร่วม</span>
            </div>
            {top.slice(0, 4).map((r, i) => (
              <button type="button" key={`${r.url || r.contentId}-${i}`} className="fb-row" onClick={() => onOpen(r)} title="วิเคราะห์คลิปนี้">
                <span>{r.topic || "ไม่ระบุประเด็น"}</span>
                <b className="n">{compact(r.views)}</b>
                <span className="n">{compact(r.likes + r.comments + r.shares)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {platform === "Instagram" && (
        <div className="ps-grid g11">
          <div className="ps-card">
            <h3>Reels ยอดนิยม</h3>
            {reels.length ? <PostTiles rows={topPosts(reels, 4)} stored={stored} onOpen={onOpen} /> : <p className="ps-muted">ไม่มี Reels ในช่วงนี้</p>}
          </div>
          <div className="ps-card">
            <h3>คนดูต่อหรือปัดทิ้ง (Reels)</h3>
            {skip && skip.skip !== null ? (
              <>
                <div className="ig-skip">
                  <span style={{ width: `${100 - skip.skip}%`, background: "#22c55e" }}>ดูต่อ {(100 - skip.skip).toFixed(0)}%</span>
                  <span style={{ width: `${skip.skip}%`, background: "#ef4444" }}>ปัดทิ้ง {skip.skip.toFixed(0)}%</span>
                </div>
                <p className="ps-muted" style={{ margin: "6px 0 0" }}>
                  ค่าเฉลี่ยของ Reels ในช่วงนี้ (ถ่วงตามวิว {num(skip.posts)} Reels) · ปัดทิ้ง = Skip rate ที่ Instagram ส่งมา{skip.watchSec !== null ? ` · ดูเฉลี่ย ${skip.watchSec.toFixed(1)} วินาที` : ""}
                </p>
              </>
            ) : (
              <p className="ps-muted">ยังไม่มี Skip rate ของ Reels ในช่วงนี้</p>
            )}
            <h3 style={{ marginTop: 12 }}>การมีส่วนร่วมต่อ 1,000 วิว</h3>
            {igEngagement.map((x) => (
              <div key={x.k} className="ig-eng">
                <span>{x.k}</span>
                <div>
                  <span style={{ width: `${igMax ? (x.v / igMax) * 100 : 0}%`, background: x.c }} />
                  <b>{x.v.toFixed(1)}</b>
                </div>
              </div>
            ))}
            <p className="ps-muted" style={{ margin: "6px 0 0" }}>
              ทุกโพสต์ Instagram ในช่วงนี้ · Instagram ไม่ส่งยอดบันทึก (Save) มา
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- TV ----------

interface TvProps {
  cur: RecordRow[];
  prev: RecordRow[];
  /** TV rows passing the filters, every date (for the competitor comparison). */
  mine: RecordRow[];
  startDate: string;
  endDate: string;
  compareText: string;
}

export function TvStudio({ cur, prev, mine, startDate, endDate, compareText }: TvProps) {
  const motion = useMotion();
  const [ch, setCh] = useState<TvChannel>("One31");
  const [sources, setSources] = useState<CompetitorSource[] | null>(null);
  useEffect(() => {
    let alive = true;
    track(loadTvCompetitors())
      .then((s) => alive && setSources(s))
      .catch(() => alive && setSources([]));
    return () => {
      alive = false;
    };
  }, []);
  const eps = useMemo(() => episodeRatings(cur, ch), [cur, ch]);
  const epsPrev = useMemo(() => episodeRatings(prev, ch), [prev, ch]);
  const zones = useMemo(() => zoneRatings(cur), [cur]);
  // The channel's audience: One31 in audienceTotal, GMM25 in gmmAudience (merged TV rows).
  const audience = useMemo(() => cur.reduce((a, r) => a + ((ch === "GMM25" ? r.gmmAudience : r.audienceTotal) || 0), 0), [cur, ch]);
  // Competitors of both channels, always (not tied to the One31 / GMM25 switch).
  const rankings = useMemo(
    () =>
      (["One31", "GMM25"] as const).map((c) => {
        const source = sourceOf(sources || [], c);
        if (!source) return { ch: c, list: [] };
        // Top 6, and ถกไม่เถียง's own place when it is below them.
        const all = competitorRanking(source.rows, ownRatings(mine, source.program, c), "channel", startDate, endDate).map((x, i) => ({ ...x, place: i + 1 }));
        const top = all.slice(0, 6);
        const mineRow = all.find((x) => x.own || x.key === OWN_KEY);
        return { ch: c, list: mineRow && !top.includes(mineRow) ? [...top, mineRow] : top };
      }),
    [sources, mine, startDate, endDate],
  );
  const best = Math.max(0, ...eps.list.map((x) => x.rating));
  const light = ch === "GMM25" ? "#c4b5fd" : "#93b4f5";
  const ratingChange = eps.avg !== null && epsPrev.avg ? (eps.avg - epsPrev.avg) / epsPrev.avg : null;
  const zoneMax = Math.max(0, ...zones.map((z) => z.rating || 0));

  return (
    <section className="ps ps-tv tvx" aria-label="TV board">
      <div className="tvx-head">
        <div className="ht-seg" role="group" aria-label="ช่อง">
          {(["One31", "GMM25"] as const).map((c) => (
            <button key={c} className={ch === c ? "on" : ""} onClick={() => setCh(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="tvx-kpis">
          <div>
            <small>Rating เฉลี่ย {ch}</small>
            <b>{eps.avg === null ? "-" : <CountUp value={eps.avg} format={fixed(3)} />}</b>{" "}
            {ratingChange !== null && (
              <span className={`tvx-badge ${ratingChange >= 0 ? "up" : "down"}`} title={compareText}>
                {ratingChange >= 0 ? "▲" : "▼"} {Math.abs(ratingChange * 100).toFixed(0)}% ช่วงก่อน
              </span>
            )}
          </div>
          <div>
            <small>ผู้ชมรวม</small>
            <b>
              <CountUp value={audience} format={compact} />
            </b>
          </div>
          <div>
            <small>จำนวนเทป</small>
            <b>{num(eps.list.length)}</b>
          </div>
        </div>
      </div>
      <div className="ps-grid g2">
        <div className="ps-card">
          <h3>Rating รายเทป</h3>
          <p className="ps-muted">เส้นประ = ค่าเฉลี่ยช่วงนี้ · ชี้แท่งเพื่อดูประเด็น · เปลี่ยนช่องแล้วแท่งจะยืด/หดไปค่าใหม่</p>
          {eps.list.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={eps.list} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => String(Number(d.slice(8, 10)))} tick={{ fontSize: 9, fill: "#6a7892" }} stroke="none" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#6a7892" }} width={44} stroke="none" tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, _n, p) => [Number(v).toFixed(3), (p?.payload as { topic: string })?.topic || "Rating"]} />
                <Bar dataKey="rating" radius={[3, 3, 0, 0]} isAnimationActive={motion}>
                  {eps.list.map((x) => (
                    <Cell key={x.date} fill={x.rating === best ? "#0757e8" : light} />
                  ))}
                </Bar>
                {eps.avg !== null && <ReferenceLine y={eps.avg} stroke="#0f1b31" strokeDasharray="5 4" strokeOpacity={0.55} />}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="ps-muted">ไม่มีเรตติ้ง {ch} ในช่วงนี้</p>
          )}
        </div>
        <div className="ps-card">
          <h3>Rating ตามพื้นที่</h3>
          <p className="ps-muted">เฉลี่ยของเทปในช่วงนี้{ch === "GMM25" ? " · ไฟล์ TV มีแยกพื้นที่เฉพาะ One31" : ""}</p>
          {ch === "One31" ? (
            zones
              .filter((z) => z.rating !== null)
              .map((z) => (
                <div key={z.key} className="zone">
                  <span>{z.label}</span>
                  <div>
                    <span style={{ width: `${zoneMax ? ((z.rating as number) / zoneMax) * 100 : 0}%`, background: "#0757e8" }} />
                  </div>
                  <b>{(z.rating as number).toFixed(2)}</b>
                </div>
              ))
          ) : (
            <p className="ps-muted">ไม่มีข้อมูลแยกพื้นที่ของ GMM25</p>
          )}
          <h3 className="ps-gap">เทียบคู่แข่งช่วงเวลาเดียวกัน</h3>
          <p className="ps-muted">แสดงทั้ง 2 ช่องเสมอ ไม่ขึ้นกับปุ่มเลือกช่องด้านบน</p>
          <div className="ps-comp2 tight">
            {rankings.map(({ ch: c, list }) => {
              const max = Math.max(0, ...list.map((x) => x.avg));
              return (
                <div key={c}>
                  <span className={`ps-chip ${c === "GMM25" ? "gmm" : "one"}`}>{c}</span>
                  {sources === null ? (
                    <Skeleton lines={4} height={0} />
                  ) : list.length ? (
                    <div className="rank">
                      {list.map((x) => {
                        const own = x.own || x.key === OWN_KEY;
                        return (
                          <div key={x.key} className={`row${own ? " own" : ""}`} title={x.winShare === null ? `${x.days} วัน` : `ถกไม่เถียงชนะ ${pct(x.winShare, 0)} ของวันที่ออกอากาศพร้อมกัน`}>
                            <span>{x.place}</span>
                            <div>
                              <div className="rank-name">
                                {x.key}
                                {own ? " (เรา)" : ""}
                              </div>
                              <div className="bar">
                                <span style={{ width: `${max ? (x.avg / max) * 100 : 0}%` }} />
                              </div>
                            </div>
                            <span className="n">{x.avg.toFixed(3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="ps-muted">ไม่มีข้อมูลคู่แข่งของ {c} ในช่วงนี้</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
