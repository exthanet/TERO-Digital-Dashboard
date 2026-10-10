"use client";
// รายงานรวมแพลตฟอร์ม: the parts that compare every platform at once
// (Cross Platform, Platform Insight, Hashtag Report), as in output/motion-demo.html.
// Numbers from lib/dashboard/platformStudio.ts and platformReport.ts.
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { MIN_POSTS_PER_CELL, WEEKDAYS, bestSlots, change, postingHeatmap } from "@/lib/dashboard/platformReport";
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
  const f = mode === "pct" ? (v: number) => pct(v, 0) : compact;

  return (
    <article className="pi-card">
      <div className="pi-head">
        <div>
          <h3>Cross Platform · ยอดวิวรายวันแยกแพลตฟอร์ม</h3>
          <p className="ps-muted">ตามวันที่ลงโพสต์ · กดชื่อแพลตฟอร์มเพื่อซ่อน/แสดง · ชี้กราฟดูตัวเลขรายวัน</p>
        </div>
        <div className="segmented" role="group" aria-label="รูปแบบกราฟ">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? "active" : ""} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        {mode === "lines" ? (
          <LineChart data={view} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tickFormatter={f} tick={{ fontSize: 11 }} width={56} />
            <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, n) => [f(Number(v)), String(n)]} itemSorter={(i) => DIGITAL.indexOf(i.dataKey as (typeof DIGITAL)[number])} />
            {shown.map((p) => (
              <Line key={p} type="monotone" dataKey={p} stroke={COLORS[p]} strokeWidth={2} dot={false} isAnimationActive={motion} />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={view} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset={mode === "pct" ? "expand" : "none"}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tickFormatter={f} tick={{ fontSize: 11 }} width={56} />
            <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, n) => [f(Number(v)), String(n)]} itemSorter={(i) => DIGITAL.indexOf(i.dataKey as (typeof DIGITAL)[number])} />
            {shown.map((p) => (
              <Area key={p} type="monotone" dataKey={p} stackId="1" stroke={COLORS[p]} fill={COLORS[p]} fillOpacity={0.55} isAnimationActive={motion} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
      <Legend items={DIGITAL} off={off} toggle={toggle} />
      <p className="pi-totals">
        {totals.map((t) => (
          <span key={t.p}>
            {t.p} <b>{compact(t.v)}</b>
          </span>
        ))}
      </p>
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
  const slots = useMemo(() => bestSlots(heat), [heat]);
  const heatMax = Math.max(0, ...heat.cells.flat().map((c) => c.medianViews || 0));
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
        <p className="ps-muted">
          สีเข้ม = ค่ากลางวิวต่อโพสต์สูง (ต้องมีอย่างน้อย {MIN_POSTS_PER_CELL} โพสต์) · ตัวเลข = จำนวนโพสต์ · ชี้ช่องเพื่อดูตัวเลข
          {heat.noTime > 0 && ` · ไม่มีเวลาโพสต์ ${num(heat.noTime)} โพสต์`}
        </p>
        {slots.length > 0 && (
          <p className="platform-slots">
            ดีที่สุด:{" "}
            {slots.map((x, i) => (
              <span key={i}>
                {WEEKDAYS[x.day]} {hh(x.hour)} ({compact(x.medianViews)} วิว · {x.posts} โพสต์)
              </span>
            ))}
          </p>
        )}
        <div className="table-scroll">
          <table className="platform-heat">
            <thead>
              <tr>
                <th />
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.cells.map((row, d) => (
                <tr key={d}>
                  <th>{WEEKDAYS[d]}</th>
                  {row.map((c, h) => (
                    <td
                      key={h}
                      className={c.medianViews === null ? (c.posts ? "few" : "none") : ""}
                      style={c.medianViews !== null && heatMax ? { background: `color-mix(in srgb, #4f46e5 ${Math.round(12 + (c.medianViews / heatMax) * 88)}%, white)`, color: c.medianViews / heatMax > 0.5 ? "#fff" : undefined } : undefined}
                      title={`${WEEKDAYS[d]} ${hh(h)} · ${c.posts} โพสต์${c.medianViews !== null ? ` · ค่ากลาง ${num(c.medianViews)} วิว` : c.posts ? " · น้อยเกินไปที่จะสรุป" : ""}`}
                    >
                      {c.posts || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ps-muted">เวลาโพสต์เป็นเวลาไทยตามที่บันทึก · เป็นความสัมพันธ์จากข้อมูล ควรทดลองยืนยันก่อนเปลี่ยนแผน</p>
      </article>
    </div>
  );
}

// ---------- Hashtag Report ----------

const TAG_TABS = ["รวมทุกแพลตฟอร์ม", ...DIGITAL] as const;
const SHOW_TAGS = 10;

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

export function HashtagReport({ cur, prev, endDate, onOpen }: { cur: RecordRow[]; prev: RecordRow[]; endDate: string; onOpen: (r: RecordRow) => void }) {
  const [tab, setTab] = useState<(typeof TAG_TABS)[number]>("รวมทุกแพลตฟอร์ม");
  const [pick, setPick] = useState("");
  const [all, setAll] = useState(false);
  const inTab = useMemo(() => {
    const keep = (r: RecordRow) => (tab === "รวมทุกแพลตฟอร์ม" ? (DIGITAL as readonly string[]).includes(r.platform) : r.platform === tab);
    return { cur: cur.filter(keep), prev: prev.filter(keep) };
  }, [cur, prev, tab]);
  const list = useMemo(() => hashtagRanking(inTab.cur, inTab.prev, CHANNEL_TAGS, 2, "views"), [inTab]);
  const shown = all ? list : list.slice(0, SHOW_TAGS);
  const chosen = list.find((t) => t.tag === pick) || list[0];
  const detail = useMemo(() => (chosen ? tagDetail(chosen, CHANNEL_TAGS) : null), [chosen]);
  const color = tab === "รวมทุกแพลตฟอร์ม" ? "#4f46e5" : COLORS[tab];
  const maxViews = Math.max(1, ...shown.map((t) => t.views));
  const splitSum = detail ? detail.byPlatform.reduce((a, x) => a + x.views, 0) : 0;
  const splitMax = detail ? Math.max(1, ...detail.byPlatform.map((x) => x.views)) : 1;
  const coMax = detail ? Math.max(1, ...detail.together.map((x) => x.posts)) : 1;
  const topViews = list.slice(0, SHOW_TAGS).reduce((a, t) => a + t.views, 0);

  return (
    <article className="pi-card">
      <div className="pi-head">
        <div className="segmented" role="group" aria-label="แพลตฟอร์มของ hashtag">
          {TAG_TABS.map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-kpis three">
        <div className="pt-kpi flat">
          <small>แท็กที่ติดอันดับ</small>
          <b>{num(list.length)}</b>
        </div>
        <div className="pt-kpi flat">
          <small>โพสต์ที่มี Hashtag</small>
          <b>
            <CountUp value={hashtagShare(inTab.cur)} format={(v) => pct(v, 0)} />
          </b>
        </div>
        <div className="pt-kpi flat" title="โพสต์ที่มีหลายแท็กถูกนับในทุกแท็กที่มี">
          <small>วิวจากแท็ก 10 อันดับ</small>
          <b>
            <CountUp value={topViews} format={compact} />
          </b>
        </div>
      </div>
      {!list.length ? (
        <p className="growth-notice">ยังไม่มี hashtag ที่ใช้อย่างน้อย 2 โพสต์ในช่วงนี้</p>
      ) : (
        <div className="pi-tags">
          <div>
            <div className="pi-tag-row pi-tag-th">
              <span>#</span>
              <span>Hashtag</span>
              <span>อันดับ</span>
              <span className="pi-num">โพสต์</span>
              <span>วิว</span>
              <span className="pi-num">ER</span>
              <span>7 วัน</span>
            </div>
            <ol className="pi-tag-list">
              {shown.map((t) => (
                <li key={t.tag}>
                  <button type="button" className={`pi-tag-row${chosen?.tag === t.tag ? " on" : ""}`} onClick={() => setPick(t.tag)}>
                    <b className="pi-rank">{t.rank}</b>
                    <span className="pi-tag-name">{t.tag}</span>
                    <span className={`pi-move ${t.move === null ? "new" : t.move > 0 ? "up" : t.move < 0 ? "down" : ""}`}>
                      {t.move === null ? (prev.length ? "ใหม่" : "") : t.move > 0 ? `▲${t.move}` : t.move < 0 ? `▼${-t.move}` : "■"}
                    </span>
                    <span className="pi-num">{num(t.posts)}</span>
                    <span className="pi-views">
                      <span className="pi-tag-bar">
                        <span style={{ width: `${(t.views / maxViews) * 100}%`, background: color }} />
                      </span>
                      <small>{compact(t.views)}</small>
                    </span>
                    <span className="pi-num">{pct(t.er, 1)}</span>
                    <Spark values={tagDaily(t, endDate)} color={color} />
                  </button>
                </li>
              ))}
            </ol>
            <p className="ps-muted">กดแท็กเพื่อดูรายละเอียดทางขวา · เรียงตามยอดวิว · ▲▼ = อันดับเทียบช่วงก่อน · ซ่อนแท็กของช่อง / รายการ เช่น #ถกไม่เถียง · 7 วัน = วิวของโพสต์ที่ลงใน 7 วันสุดท้ายของช่วง</p>
            {list.length > SHOW_TAGS && (
              <button type="button" className="ranking-more" onClick={() => setAll((v) => !v)}>
                {all ? "แสดง 10 อันดับ" : `ดูทั้งหมด ${list.length} hashtag`}
              </button>
            )}
          </div>
          {chosen && detail && (
            <aside className="pi-tag-detail">
              <h4>{chosen.tag}</h4>
              <p className="ps-muted">
                {num(chosen.posts)} โพสต์ · วิวรวม {compact(chosen.views)} · ER {pct(chosen.er, 1)}
              </p>
              <h5>แยกตามแพลตฟอร์ม</h5>
              {detail.byPlatform
                .filter((x) => x.posts)
                .sort((a, b) => b.views - a.views)
                .map((x) => (
                  <div key={x.platform} className="ps-bar" title={`${x.posts} โพสต์ · ${num(x.views)} วิว`}>
                    <span className="ps-bar-label">{x.platform}</span>
                    <span className="ps-bar-track">
                      <span style={{ width: `${(x.views / splitMax) * 100}%`, background: COLORS[x.platform] }} />
                    </span>
                    <b>{splitSum ? pct(x.views / splitSum, 0) : "-"}</b>
                  </div>
                ))}
              <h5>แท็กที่ใช้คู่กันบ่อย</h5>
              {detail.together.length ? (
                <div className="pi-bubbles">
                  {detail.together.map((x) => (
                    <button
                      key={x.tag}
                      type="button"
                      style={{ fontSize: `${11 + (x.posts / coMax) * 7}px`, background: `color-mix(in srgb, #4f46e5 ${Math.round(8 + (x.posts / coMax) * 22)}%, white)` }}
                      onClick={() => list.some((t) => t.tag === x.tag) && setPick(x.tag)}
                      title={`ใช้คู่กัน ${x.posts} โพสต์`}
                    >
                      {x.tag}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ps-muted">ไม่มีแท็กอื่นที่ใช้คู่กัน</p>
              )}
              <h5>คลิปวิวสูงสุด</h5>
              <ol className="ps-mini-list">
                {chosen.rows.slice(0, 5).map((r, i) => (
                  <li key={`${r.url || r.contentId}-${i}`}>
                    <button type="button" className="clip-open" onClick={() => onOpen(r)}>
                      {r.topic || "ไม่ระบุประเด็น"}
                    </button>
                    <b>{compact(r.views)}</b>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      )}
    </article>
  );
}
