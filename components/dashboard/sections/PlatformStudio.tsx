"use client";
// วิเคราะห์เชิงลึก → รายงานรายแพลตฟอร์ม: the top of each platform's page, in the
// look of that platform's own analytics (YouTube Studio, TikTok Studio, Meta
// Business Suite, Instagram, TV ratings). Numbers from lib/dashboard/platformStudio.ts.
// Only boxes the data can fill: no follower-online times, reactions or TikTok traffic
// sources, which the APIs do not give us. YouTube Analytics boxes need Deep Dive.
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { TOPIC_COLORS } from "@/lib/dashboard/constants";
import { change, digitalKpis, tvKpis } from "@/lib/dashboard/platformReport";
import {
  dailySeries,
  episodeRatings,
  groupStats,
  hourMedians,
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
type Metric = "views" | "hours" | "subs" | "posts" | "medianViews" | "er" | "sharesPer1k" | "commentsPer1k";

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
};
const TILES: Record<Digital, Metric[]> = {
  YouTube: ["views", "hours", "subs", "medianViews", "posts", "er", "sharesPer1k", "commentsPer1k"],
  TikTok: ["views", "posts", "medianViews", "er", "sharesPer1k", "commentsPer1k"],
  Facebook: ["views", "posts", "medianViews", "er", "sharesPer1k", "commentsPer1k"],
  Instagram: ["views", "posts", "medianViews", "er", "sharesPer1k", "commentsPer1k"],
};
const SKIN: Record<Digital, { cls: string; accent: string; grid: string; text: string }> = {
  YouTube: { cls: "ps-yt", accent: "#065fd4", grid: "#e5e5e5", text: "#606060" },
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

function MainChart({ data, metric, color, grid, text }: { data: DayPoint[]; metric: Metric; color: string; grid: string; text: string }) {
  const motion = useMotion();
  const f = METRICS[metric].format;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`ps-fill-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: text }} stroke={grid} minTickGap={24} />
        <YAxis tickFormatter={(v: number) => f(v)} tick={{ fontSize: 11, fill: text }} stroke={grid} width={56} />
        <Tooltip
          labelFormatter={(d) => fullDate(String(d))}
          formatter={(v, _n, p) => [`${v === null || v === undefined ? "-" : f(Number(v))} · ${num((p?.payload as DayPoint)?.posts || 0)} โพสต์`, METRICS[metric].label]}
        />
        <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={2} fill={`url(#ps-fill-${color.slice(1)})`} isAnimationActive={motion} animationDuration={700} connectNulls />
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
  const valueOf = (m: Metric, kk: typeof k | null, y: typeof yt): number | null => {
    if (m === "hours") return y ? y.hours : null;
    if (m === "subs") return y ? y.subs : null;
    if (!kk) return null;
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
  const types = useMemo(() => (platform === "Facebook" || platform === "Instagram" ? groupStats(cur, (r) => r.vdoType) : []), [cur, platform]);
  const mix = useMemo(() => interactionMix(cur), [cur]);
  const reels = useMemo(() => cur.filter((r) => /reel/i.test(r.vdoType)), [cur]);
  const skip = useMemo(() => (platform === "Instagram" ? skipStats(reels) : null), [reels, platform]);
  const motion = useMotion();

  const tileRow = (
    <div className="ps-tiles">
      {tiles.map((m) => {
        const now = valueOf(m, k, yt);
        const before = kp ? valueOf(m, kp, ytPrev) : null;
        return (
          <button type="button" key={m} className={`ps-tile${metric === m ? " on" : ""}`} onClick={() => setMetric(m)} aria-pressed={metric === m} title={METRICS[m].detail}>
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
  const mixItems = [
    { label: "Like", value: mix.total ? mix.likes / mix.total : 0 },
    { label: "Comment", value: mix.total ? mix.comments / mix.total : 0 },
    { label: "Share", value: mix.total ? mix.shares / mix.total : 0 },
  ];

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
            {chart}
            <div className="ps-card">
              <h3>ยอดดูตามประเภทเนื้อหา</h3>
              <p className="ps-muted">TikTok ไม่ส่งแหล่งที่มาของยอดดูมา จึงแสดงสัดส่วนวิวตามประเภทเนื้อหาแทน</p>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={topics} dataKey="views" nameKey="key" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none" isAnimationActive={motion}>
                    {topics.map((t, i) => (
                      <Cell key={t.key} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${compact(Number(v))} วิว`, String(n)]} />
                </PieChart>
              </ResponsiveContainer>
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
              <PostTiles rows={top} stored={stored} onOpen={onOpen} />
            </div>
            <div className="ps-card">
              <h3>การมีส่วนร่วม</h3>
              <div className="ps-rings">
                <Ring value={rings.er} label="ER" color={skin.accent} track={skin.grid} />
                <Ring value={rings.sharedPosts} label="โพสต์ที่มีคนแชร์" color="#25f4ee" track={skin.grid} />
                <Ring value={rings.commentedPosts} label="โพสต์ที่มีคอมเมนต์" color="#ffffff" track={skin.grid} />
              </div>
              <h3 className="ps-gap">ชั่วโมงที่โพสต์แล้วได้วิว</h3>
              <p className="ps-muted">ค่ากลางวิวต่อโพสต์ตามชั่วโมงที่ลง (อย่างน้อย 3 โพสต์) · TikTok ไม่ส่งเวลาที่ผู้ติดตามออนไลน์มา</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={hours} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: skin.text }} stroke={skin.grid} interval={2} />
                  <Tooltip
                    cursor={{ fill: "#ffffff14" }}
                    labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 น.`}
                    formatter={(v, _n, p) => [v === null || v === undefined ? `${(p?.payload as { posts: number })?.posts || 0} โพสต์ น้อยเกินไป` : `${compact(Number(v))} วิว/โพสต์`, "ค่ากลาง"]}
                  />
                  <Bar dataKey="medianViews" fill={skin.accent} radius={[3, 3, 0, 0]} isAnimationActive={motion} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {platform === "Facebook" && (
        <>
          <div className="ps-grid g2">
            {chart}
            <div className="ps-card">
              <h3>Reels เทียบโพสต์ปกติ</h3>
              {types.map((t) => (
                <div key={t.key} className="ps-split">
                  <div className="ps-split-head">
                    <b>{t.key}</b>
                    <span>
                      {num(t.posts)} โพสต์ · ค่ากลาง {t.medianViews === null ? "-" : compact(t.medianViews)} วิว
                    </span>
                  </div>
                  <Bars
                    items={[
                      { label: "สัดส่วนโพสต์", value: t.postShare },
                      { label: "สัดส่วนวิว", value: t.viewShare },
                    ]}
                    color={/reel/i.test(t.key) ? "#f02849" : skin.accent}
                  />
                </div>
              ))}
              <h3 className="ps-gap">การมีส่วนร่วมแยกประเภท</h3>
              <p className="ps-muted">Facebook ส่งมาเฉพาะยอด Like รวม ไม่แยกอีโมจิ จึงแสดงสัดส่วน Like / Comment / Share แทน</p>
              <Bars items={mixItems} color={skin.accent} />
            </div>
          </div>
          <div className="ps-card">
            <h3>โพสต์ยอดนิยม</h3>
            {top.map((r, i) => (
              <PostRow key={`${r.url || r.contentId}-${i}`} row={r} stored={stored} i={i} onOpen={onOpen} extra={`ER ${pct(r.views > 0 ? (r.likes + r.comments + r.shares) / r.views : 0, 2)}`} />
            ))}
          </div>
        </>
      )}

      {platform === "Instagram" && (
        <>
          {chart}
          <div className="ps-grid g11">
            <div className="ps-card">
              <h3>Reels ยอดนิยม</h3>
              {reels.length ? <PostTiles rows={topPosts(reels, 8)} stored={stored} onOpen={onOpen} /> : <p className="ps-muted">ไม่มี Reels ในช่วงนี้</p>}
            </div>
            <div className="ps-card">
              <h3>คนดูต่อหรือปัดทิ้ง (Reels)</h3>
              {skip && skip.skip !== null ? (
                <>
                  <div className="ps-skip">
                    <span style={{ width: `${100 - skip.skip}%` }}>ดูต่อ {(100 - skip.skip).toFixed(0)}%</span>
                    <span style={{ width: `${skip.skip}%` }}>ปัดทิ้ง {skip.skip.toFixed(0)}%</span>
                  </div>
                  <p className="ps-muted">
                    Skip rate เฉลี่ยถ่วงตามวิว {num(skip.posts)} Reels{skip.watchSec !== null ? ` · ดูเฉลี่ย ${skip.watchSec.toFixed(1)} วินาที` : ""}
                  </p>
                </>
              ) : (
                <p className="ps-muted">ยังไม่มี Skip rate ของ Reels ในช่วงนี้</p>
              )}
              <h3 className="ps-gap">การมีส่วนร่วมต่อ 1,000 วิว</h3>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={types} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={skin.grid} vertical={false} />
                  <XAxis dataKey="key" tick={{ fontSize: 11, fill: skin.text }} stroke={skin.grid} />
                  <YAxis tick={{ fontSize: 10, fill: skin.text }} stroke={skin.grid} width={36} />
                  <Tooltip formatter={(v, n) => [Number(v).toFixed(2), String(n)]} />
                  <Bar dataKey="likesPer1k" name="Like" fill="#dd2a7b" radius={[3, 3, 0, 0]} isAnimationActive={motion} />
                  <Bar dataKey="commentsPer1k" name="Comment" fill="#8134af" radius={[3, 3, 0, 0]} isAnimationActive={motion} />
                  <Bar dataKey="sharesPer1k" name="Share" fill="#f58529" radius={[3, 3, 0, 0]} isAnimationActive={motion} />
                </BarChart>
              </ResponsiveContainer>
              <ul className="ps-legend">
                <li>
                  <i style={{ background: "#dd2a7b" }} />
                  Like
                </li>
                <li>
                  <i style={{ background: "#8134af" }} />
                  Comment
                </li>
                <li>
                  <i style={{ background: "#f58529" }} />
                  Share
                </li>
              </ul>
            </div>
          </div>
        </>
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
  const t = useMemo(() => tvKpis(cur), [cur]);
  const tp = useMemo(() => (prev.length ? tvKpis(prev) : null), [prev]);
  const eps = useMemo(() => episodeRatings(cur, ch), [cur, ch]);
  const zones = useMemo(() => zoneRatings(cur), [cur]);
  const source = useMemo(() => (sources || []).find((s) => (ch === "GMM25" ? /gmm/i.test(s.channel) : !/gmm/i.test(s.channel))), [sources, ch]);
  const ranking = useMemo(() => {
    if (!source) return [];
    const own = new Map<string, number>();
    for (const r of mine) {
      if (r.program !== source.program) continue;
      const v = ch === "GMM25" ? r.gmmRating : r.ratingTotal;
      if (v > 0) own.set(r.date, v);
    }
    // Top 6, and ถกไม่เถียง's own place when it is below them.
    const all = competitorRanking(source.rows, own, "channel", startDate, endDate).map((x, i) => ({ ...x, place: i + 1 }));
    const top = all.slice(0, 6);
    const mineRow = all.find((x) => x.own || x.key === OWN_KEY);
    return mineRow && !top.includes(mineRow) ? [...top, mineRow] : top;
  }, [source, mine, ch, startDate, endDate]);
  const color = ch === "GMM25" ? "#f59e0b" : "#10b981";

  const tiles: { label: string; now: number | null; before: number | null | undefined; format: (v: number) => string }[] = [
    { label: "จำนวนเทป", now: t.episodes, before: tp?.episodes, format: num },
    { label: "เรตติ้งเฉลี่ย One31", now: t.rating, before: tp ? tp.rating : undefined, format: fixed(3) },
    { label: "ผู้ชมรวม", now: t.audience, before: tp?.audience, format: compact },
    { label: "GMM25 ช่วงเดียวกัน", now: t.gmmRating, before: tp ? tp.gmmRating : undefined, format: fixed(3) },
  ];

  return (
    <section className="ps ps-tv" aria-label="TV board">
      <div className="ps-tv-head">
        <div className="segmented" role="group" aria-label="ช่อง">
          {(["One31", "GMM25"] as const).map((c) => (
            <button key={c} className={ch === c ? "active" : ""} onClick={() => setCh(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="ps-tiles">
          {tiles.map((x) => (
            <div key={x.label} className="ps-tile static">
              <small>{x.label}</small>
              <b>{x.now === null ? "-" : <CountUp value={x.now} format={x.format} />}</b>
              <Growth value={x.before === undefined ? null : change(x.now, x.before ?? null)} title={compareText} />
            </div>
          ))}
        </div>
      </div>
      <div className="ps-grid g2">
        <div className="ps-card">
          <h3>Rating รายเทป · {ch}</h3>
          <p className="ps-muted">เส้นประ = ค่าเฉลี่ยช่วงนี้{eps.avg !== null ? ` (${eps.avg.toFixed(3)})` : ""} · ชี้แท่งเพื่อดูประเด็น</p>
          {eps.list.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={eps.list} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} width={44} />
                <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, _n, p) => [Number(v).toFixed(3), (p?.payload as { topic: string })?.topic || "Rating"]} />
                {eps.avg !== null && <ReferenceLine y={eps.avg} stroke="#64748b" strokeDasharray="5 4" />}
                <Bar dataKey="rating" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={motion} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="ps-muted">ไม่มีเรตติ้ง {ch} ในช่วงนี้</p>
          )}
        </div>
        <div className="ps-card">
          <h3>Rating ตามพื้นที่ · One31</h3>
          <p className="ps-muted">เฉลี่ยของเทปในช่วงนี้ · ไฟล์ TV มีแยกพื้นที่เฉพาะ One31</p>
          <Bars items={zones.filter((z) => z.rating !== null).map((z) => ({ label: z.label, value: z.rating as number }))} color="#10b981" format={fixed(3)} />
          <h3 className="ps-gap">เทียบคู่แข่งช่วงเวลาเดียวกัน · {ch}</h3>
          {sources === null ? (
            <Skeleton lines={4} height={0} />
          ) : ranking.length ? (
            <ol className="ps-rank-list">
              {ranking.map((x) => (
                <li key={x.key} className={x.own || x.key === OWN_KEY ? "own" : ""}>
                  <b>{x.place}</b>
                  <span>{x.key}</span>
                  <strong>{x.avg.toFixed(3)}</strong>
                  <small>{x.winShare === null ? `${x.days} วัน` : `ชนะ ${pct(x.winShare, 0)}`}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ps-muted">ไม่มีข้อมูลคู่แข่งของ {ch} ในช่วงนี้</p>
          )}
        </div>
      </div>
    </section>
  );
}
