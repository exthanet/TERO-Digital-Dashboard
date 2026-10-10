"use client";
// รายงานรวมแพลตฟอร์ม: the parts that compare every platform at once
// (Cross Platform, Platform Insight, Hashtag Report), as in output/motion-demo.html.
// Numbers from lib/dashboard/platformStudio.ts and platformReport.ts.
import { Fragment, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { CHANNEL_TAGS } from "@/lib/dashboard/trendingHashtags";
import { WEEKDAYS, change, postingHeatmap } from "@/lib/dashboard/platformReport";
import { DIGITAL, crossDaily, hashtagRanking, hashtagShare, strengths, tagDaily, tagDetail } from "@/lib/dashboard/platformStudio";
import { Growth } from "@/components/dashboard/shared/Growth";
import { CountUp, useMotion } from "@/components/dashboard/shared/Motion";

const COLORS: Record<string, string> = { ...PLATFORM_COLORS, TikTok: "#0f172a" };
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const shortDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const fullDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");

function Legend({ items, off, toggle }: { items: readonly string[]; off: Set<string>; toggle: (p: string) => void }) {
  return (
    <div className="pi-legend">
      {items.map((p) => (
        <button key={p} type="button" className={off.has(p) ? "off" : ""} onClick={() => toggle(p)} aria-pressed={!off.has(p)}>
          <i style={{ background: COLORS[p] }} />
          {p}
        </button>
      ))}
    </div>
  );
}

function useToggle() {
  const [off, setOff] = useState<Set<string>>(new Set());
  const toggle = (p: string) =>
    setOff((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  return { off, toggle };
}

// ---------- Cross Platform ----------

type Mode = "stack" | "lines" | "pct";
const MODES: { id: Mode; label: string }[] = [
  { id: "stack", label: "ซ้อนกัน" },
  { id: "lines", label: "แยกเส้น" },
  { id: "pct", label: "สัดส่วน 100%" },
];

export function CrossPlatform({ cur, startDate, endDate }: { cur: RecordRow[]; startDate: string; endDate: string }) {
  const motion = useMotion();
  const [mode, setMode] = useState<Mode>("stack");
  const { off, toggle } = useToggle();
  const data = useMemo(() => crossDaily(cur, startDate, endDate), [cur, startDate, endDate]);
  const shown = DIGITAL.filter((p) => !off.has(p));
  const view = useMemo(
    () =>
      mode !== "pct"
        ? data
        : data.map((d) => {
            const sum = shown.reduce((a, p) => a + (Number(d[p]) || 0), 0);
            return { ...d, ...Object.fromEntries(shown.map((p) => [p, sum > 0 ? (Number(d[p]) || 0) / sum : 0])) };
          }),
    [data, mode, shown],
  );
  const totals = DIGITAL.map((p) => ({ p, v: data.reduce((a, d) => a + (Number(d[p]) || 0), 0) }));
  const all = totals.reduce((a, t) => a + t.v, 0);
  const f = mode === "pct" ? (v: number) => pct(v, 0) : compact;
  // As the demo: filled bands with their own line on top; "แยกเส้น" keeps a faint fill under each line.
  const fill = mode === "lines" ? 0.06 : 0.75;

  return (
    <article className="pi-card xp">
      <h3>Cross Platform · ยอดวิวรายวันแยกแพลตฟอร์ม</h3>
      <p className="ps-muted">สลับ “ซ้อนกัน / แยกเส้น / สัดส่วน 100%” แล้วกราฟจะเปลี่ยนรูปต่อเนื่อง · กดชื่อแพลตฟอร์มเพื่อซ่อน/แสดง · ชี้กราฟดูตัวเลขรายวัน</p>
      <div className="xp-bar">
        <div className="ht-seg" role="group" aria-label="รูปแบบกราฟ">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? "on" : ""} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="xp-legend">
          {DIGITAL.map((p) => (
            <button key={p} type="button" className={off.has(p) ? "off" : ""} onClick={() => toggle(p)} aria-pressed={!off.has(p)}>
              <i style={{ background: COLORS[p] }} />
              {p}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={view} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#dce3ee" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#6a7892" }} stroke="#dce3ee" minTickGap={28} />
          <YAxis tickFormatter={f} tick={{ fontSize: 11, fill: "#6a7892" }} width={56} stroke="none" tickCount={5} domain={mode === "pct" ? [0, 1] : [0, "auto"]} />
          <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, n) => [f(Number(v)), String(n)]} itemSorter={(i) => DIGITAL.indexOf(i.dataKey as (typeof DIGITAL)[number])} />
          {shown.map((p) => (
            <Area
              key={p}
              type="linear"
              dataKey={p}
              stackId={mode === "lines" ? undefined : "1"}
              stroke={COLORS[p]}
              strokeWidth={2}
              fill={COLORS[p]}
              fillOpacity={fill}
              isAnimationActive={motion}
              animationDuration={750}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="xp-sum">
        {totals.map((t) => (
          <div key={t.p} style={{ borderColor: COLORS[t.p] }} className={off.has(t.p) ? "off" : ""}>
            <small>{t.p}</small>
            <b>
              <CountUp value={t.v} format={compact} />
            </b>{" "}
            <span className="ps-muted">{all ? pct(t.v / all, 0) : "-"}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

// ---------- Platform Insight ----------

export function PlatformInsight({ cur, prev, startDate, endDate, compareText }: { cur: RecordRow[]; prev: RecordRow[]; startDate: string; endDate: string; compareText: string }) {
  const motion = useMotion();
  const { off, toggle } = useToggle();
  const s = useMemo(() => strengths(cur), [cur]);
  const daily = useMemo(() => crossDaily(cur, startDate, endDate), [cur, startDate, endDate]);
  const digital = useMemo(() => cur.filter((r) => (DIGITAL as readonly string[]).includes(r.platform)), [cur]);
  const heat = useMemo(() => postingHeatmap(digital), [digital]);
  const prevViews = useMemo(() => new Map(DIGITAL.map((p) => [p, prev.filter((r) => r.platform === p).reduce((a, r) => a + r.views, 0)])), [prev]);

  return (
    <div className="pi-grid">
      <article className="pi-card">
        <h3>จุดแข็งเทียบกัน</h3>
        <p className="ps-muted">ทุกแกนเทียบกับแพลตฟอร์มที่ดีที่สุด (= ขอบนอก) · กดชื่อเพื่อซ่อน/แสดง</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={s.radar} outerRadius="72%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip
              formatter={(v, n, p) => {
                const axis = (p?.payload as { axis: string })?.axis;
                const raw = s.raw.find((x) => x.platform === n);
                const key = { วิวรวม: "views", จำนวนโพสต์: "posts", วิวต่อโพสต์: "medianViews", ER: "er", "แชร์ / 1K วิว": "sharesPer1k", "คอมเมนต์ / 1K วิว": "commentsPer1k" }[axis] as keyof NonNullable<typeof raw>;
                const val = raw ? Number(raw[key]) : 0;
                return [`${key === "er" ? pct(val, 2) : key === "views" || key === "medianViews" ? compact(val) : key === "posts" ? num(val) : val.toFixed(2)} (${pct(Number(v), 0)} ของอันดับ 1)`, String(n)];
              }}
            />
            {DIGITAL.filter((p) => !off.has(p)).map((p) => (
              <Radar key={p} dataKey={p} stroke={COLORS[p]} fill={COLORS[p]} fillOpacity={0.12} strokeWidth={2} isAnimationActive={motion} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
        <Legend items={DIGITAL} off={off} toggle={toggle} />
      </article>

      <article className="pi-card">
        <h3>ยอดวิวรายวัน แยกแพลตฟอร์ม</h3>
        <p className="ps-muted">เส้นเล็กของแต่ละแพลตฟอร์ม · % {compareText || "ไม่มีช่วงก่อนให้เทียบ"}</p>
        <div className="pi-sparks">
          {DIGITAL.map((p) => {
            const total = daily.reduce((a, d) => a + (Number(d[p]) || 0), 0);
            return (
              <div key={p} className="pi-spark">
                <div>
                  <small>
                    <i style={{ background: COLORS[p] }} />
                    {p}
                  </small>
                  <b>{compact(total)}</b>
                  <Growth value={prev.length ? change(total, prevViews.get(p) || 0) : null} title={compareText} />
                </div>
                <ResponsiveContainer width="100%" height={48}>
                  <AreaChart data={daily} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <Area type="monotone" dataKey={p} stroke={COLORS[p]} fill={COLORS[p]} fillOpacity={0.15} strokeWidth={1.6} isAnimationActive={motion} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </article>

      <article className="pi-card pi-wide">
        <h3>วันและเวลาที่โพสต์แล้วได้ผล (ทุกแพลตฟอร์ม)</h3>
        <p className="ps-muted">สีเข้ม = ค่ากลางวิวต่อโพสต์สูง · ชี้ช่องเพื่อดูตัวเลข · ช่องสีอ่อนไม่มีสี = โพสต์ไม่ถึง 3 โพสต์</p>
        <HeatGrid heat={heat} />
      </article>
    </div>
  );
}

/** Weekday × hour squares as in the demo: the darker, the higher the median views per post; hover for the numbers. */
function HeatGrid({ heat }: { heat: ReturnType<typeof postingHeatmap> }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  // Shade by rank among the cells with enough posts, so one very high hour does not wash out the rest.
  const ranked = [...new Set(heat.cells.flat().map((c) => c.medianViews).filter((v): v is number => v !== null))].sort((a, b) => a - b);
  const shade = (v: number) => (ranked.length > 1 ? ranked.indexOf(v) / (ranked.length - 1) : 1);
  return (
    <div className="pi-heat-wrap" onMouseLeave={() => setTip(null)}>
      <div className="pi-heat">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="pi-heat-h">
            {h % 3 ? "" : h}
          </span>
        ))}
        {heat.cells.map((row, d) => (
          <Fragment key={d}>
            <span className="pi-heat-d">{WEEKDAYS[d]}</span>
            {row.map((c, h) => {
              const text = `${WEEKDAYS[d]} ${hh(h)} · ${c.medianViews !== null ? `ค่ากลาง ${compact(c.medianViews)} วิว/โพสต์ · ${c.posts} โพสต์` : c.posts ? `${c.posts} โพสต์ (น้อยเกินไปที่จะสรุป)` : "ไม่มีโพสต์"}`;
              return (
                <div
                  key={h}
                  className="pi-heat-c"
                  style={{
                    backgroundColor: c.medianViews !== null ? `rgba(7, 87, 232, ${(0.12 + shade(c.medianViews) * 0.86).toFixed(2)})` : undefined,
                    animationDelay: `${h * 18 + d * 40}ms`,
                  }}
                  onMouseEnter={(e) => {
                    const box = e.currentTarget.closest(".pi-heat-wrap")!.getBoundingClientRect();
                    const r = e.currentTarget.getBoundingClientRect();
                    setTip({ text, x: Math.min(box.width - 230, Math.max(0, r.left - box.left)), y: r.top - box.top - 34 });
                  }}
                  title={text}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      {tip && (
        <div className="pi-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

// ---------- Hashtag Report (as in output/platform-report-demo.html) ----------

const TAG_TABS = ["รวมทุกแพลตฟอร์ม", ...DIGITAL] as const;
const SHOW_TAGS = 10;
/** Where the co-used tag bubbles sit (viewBox 360 × 200), biggest first. */
const BUBBLE_AT = [
  [70, 70],
  [170, 60],
  [270, 80],
  [110, 150],
  [215, 145],
  [310, 155],
  [40, 160],
];

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(0, ...values);
  const w = 74;
  const h = 22;
  const pts = values.map((v, i) => `${(1 + (i / Math.max(1, values.length - 1)) * (w - 2)).toFixed(1)},${(h - 2 - (max ? v / max : 0) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="pi-spark-svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function HashtagReport({ cur, prev, endDate }: { cur: RecordRow[]; prev: RecordRow[]; endDate: string; onOpen?: (r: RecordRow) => void }) {
  const [tab, setTab] = useState<(typeof TAG_TABS)[number]>("รวมทุกแพลตฟอร์ม");
  const [pick, setPick] = useState("");
  const inTab = useMemo(() => {
    const keep = (r: RecordRow) => (tab === "รวมทุกแพลตฟอร์ม" ? (DIGITAL as readonly string[]).includes(r.platform) : r.platform === tab);
    return { cur: cur.filter(keep), prev: prev.filter(keep) };
  }, [cur, prev, tab]);
  const all = useMemo(() => hashtagRanking(inTab.cur, inTab.prev, CHANNEL_TAGS, 2, "views"), [inTab]);
  const list = useMemo(() => all.slice(0, SHOW_TAGS), [all]);
  const chosen = useMemo(() => list.find((t) => t.tag === pick) || list[0], [list, pick]);
  const detail = useMemo(() => (chosen ? tagDetail(chosen, CHANNEL_TAGS) : null), [chosen]);
  const color = tab === "รวมทุกแพลตฟอร์ม" ? "#0757e8" : COLORS[tab];
  const maxViews = Math.max(1, ...list.map((t) => t.views));
  const split = detail ? detail.byPlatform.filter((x) => x.posts).sort((a, b) => b.views - a.views) : [];
  const splitSum = split.reduce((a, x) => a + x.views, 0);
  const splitMax = Math.max(1, ...split.map((x) => x.views));
  const bubbles = detail ? detail.together.slice(0, BUBBLE_AT.length) : [];
  const coMax = Math.max(1, ...bubbles.map((x) => x.posts));

  return (
    <article className="pi-card ht">
      <div className="ht-head">
        <div className="ht-seg" role="group" aria-label="แพลตฟอร์มของ hashtag">
          {TAG_TABS.map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="ht-kpis">
          <div>
            <small>แท็กที่ติดอันดับ</small>
            <b>{num(list.length)}</b>
          </div>
          <div>
            <small>โพสต์ที่มี Hashtag</small>
            <b>
              <CountUp value={hashtagShare(inTab.cur)} format={(v) => pct(v, 0)} />
            </b>
          </div>
          <div title="โพสต์ที่มีหลายแท็กถูกนับในทุกแท็กที่มี">
            <small>วิวจากแท็ก 10 อันดับ</small>
            <b>
              <CountUp value={list.reduce((a, t) => a + t.views, 0)} format={compact} />
            </b>
          </div>
        </div>
      </div>
      {!list.length ? (
        <p className="growth-notice">ยังไม่มี hashtag ที่ใช้อย่างน้อย 2 โพสต์ในช่วงนี้</p>
      ) : (
        <div className="ht-grid">
          <div>
            <div className="ht-row ht-th">
              <span>#</span>
              <span>Hashtag</span>
              <span>อันดับ</span>
              <span className="n">โพสต์</span>
              <span>วิว</span>
              <span className="n">ER</span>
              <span>7 วัน</span>
            </div>
            <div>
              {list.map((t, i) => (
                <button type="button" key={t.tag} className={`ht-row${chosen?.tag === t.tag ? " sel" : ""}`} onClick={() => setPick(t.tag)}>
                  <span>{i + 1}</span>
                  <span className="tg">{t.tag}</span>
                  {t.move === null ? (
                    <span className="mv" style={{ color: "#7c3aed" }}>
                      {prev.length ? "ใหม่" : ""}
                    </span>
                  ) : t.move > 0 ? (
                    <span className="mv up">▲{t.move}</span>
                  ) : t.move < 0 ? (
                    <span className="mv down">▼{-t.move}</span>
                  ) : (
                    <span className="mv" style={{ color: "#94a3b8" }}>
                      ■
                    </span>
                  )}
                  <span className="n">{num(t.posts)}</span>
                  <span className="vb">
                    <div>
                      <span style={{ width: `${(t.views / maxViews) * 100}%`, background: color }} />
                    </div>
                    <b>{compact(t.views)}</b>
                  </span>
                  <span className="n">{pct(t.er, 1)}</span>
                  <Spark values={tagDaily(t, endDate)} color={color} />
                </button>
              ))}
            </div>
            <p className="ps-muted" style={{ marginTop: 8 }}>
              กดแท็กเพื่อดูรายละเอียดทางขวา · ▲▼ = อันดับเทียบช่วงก่อน · ซ่อนแท็กของช่อง/รายการ เช่น #ถกไม่เถียง
            </p>
          </div>
          {chosen && detail && (
            <div className="ht-side">
              <h2>{chosen.tag}</h2>
              <p className="ps-muted">
                {num(chosen.posts)} โพสต์ · วิวรวม {compact(chosen.views)} · ER {pct(chosen.er, 1)}
              </p>
              <h3>แยกตามแพลตฟอร์ม</h3>
              {split.map((x) => (
                <div key={x.platform} className="ht-split" title={`${x.posts} โพสต์ · ${num(x.views)} วิว`}>
                  <span>{x.platform}</span>
                  <div>
                    <span style={{ width: `${(x.views / splitMax) * 100}%`, background: COLORS[x.platform] }} />
                  </div>
                  <b>{splitSum ? pct(x.views / splitSum, 0) : "-"}</b>
                </div>
              ))}
              <h3 style={{ marginTop: 12 }}>แท็กที่ใช้คู่กันบ่อย</h3>
              {bubbles.length ? (
                <svg className="ht-bubbles" viewBox="0 0 360 200" role="img" aria-label="แท็กที่ใช้คู่กันบ่อย">
                  {bubbles.map((x, i) => {
                    const r = 16 + 26 * (x.posts / coMax);
                    const can = all.some((t) => t.tag === x.tag) && list.some((t) => t.tag === x.tag);
                    return (
                      <g
                        key={x.tag}
                        transform={`translate(${BUBBLE_AT[i][0]},${BUBBLE_AT[i][1]})`}
                        style={{ cursor: can ? "pointer" : "default", animationDelay: `${i * 60}ms` }}
                        className="ht-bubble"
                        onClick={() => can && setPick(x.tag)}
                      >
                        <title>{`${x.tag} · ใช้คู่กัน ${x.posts} โพสต์`}</title>
                        <circle r={r} fill="#0757e8" fillOpacity={0.12 + r / 160} />
                        <text textAnchor="middle" y={4} fontSize={r > 30 ? 12 : 10} fill="#0f1b31">
                          {x.tag}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <p className="ps-muted">ไม่มีแท็กอื่นที่ใช้คู่กัน</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
