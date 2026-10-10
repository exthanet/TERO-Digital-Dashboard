"use client";
// รายงานรวมแพลตฟอร์ม: the top of the page as in output/platform-report-demo.html:
// headline tiles, Digital vs TV, share and bars by platform, top topic types (all
// following the ยอดวิว / จำนวนโพสต์ / ER switch) and ถกไม่เถียง against competitors
// on both channels. Numbers from lib/dashboard/platformStudio.ts and competitors.ts.
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS, TOPIC_COLORS } from "@/lib/dashboard/constants";
import { change, digitalKpis, tvKpis } from "@/lib/dashboard/platformReport";
import { DIGITAL, digitalVsTv, ownRatings, platformValues, sourceOf, topTopics, type PageMetric, type TvChannel } from "@/lib/dashboard/platformStudio";
import { OWN_KEY, competitorTrend } from "@/lib/dashboard/competitors";
import { loadTvCompetitors, type CompetitorSource } from "@/lib/tvCompetitorData";
import { track } from "@/lib/loadingBar";
import { Growth } from "@/components/dashboard/shared/Growth";
import { CountUp, Skeleton, useMotion } from "@/components/dashboard/shared/Motion";

const COLORS: Record<string, string> = { ...PLATFORM_COLORS, TikTok: "#0f172a" };
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const shortDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const fullDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");
export const metricText = (m: PageMetric) => ({ views: "ยอดวิว", posts: "จำนวนโพสต์", er: "ER" })[m];
export const metricFormat = (m: PageMetric) => (m === "er" ? (v: number) => pct(v, 2) : m === "posts" ? num : compact);

const isDigital = (r: RecordRow) => (DIGITAL as readonly string[]).includes(r.platform);

/** Digital views, posts, median views per post and the average rating of One31 and GMM25, against the comparison period. */
export function TopKpis({ cur, prev, compareText }: { cur: RecordRow[]; prev: RecordRow[]; compareText: string }) {
  const k = useMemo(() => digitalKpis(cur.filter(isDigital)), [cur]);
  const kp = useMemo(() => (prev.length ? digitalKpis(prev.filter(isDigital)) : null), [prev]);
  const t = useMemo(() => tvKpis(cur.filter((r) => r.platform === "TV")), [cur]);
  const tp = useMemo(() => (prev.length ? tvKpis(prev.filter((r) => r.platform === "TV")) : null), [prev]);
  const tiles = [
    { label: "ยอดวิวรวม (Digital)", now: k.views, before: kp?.views ?? null, f: compact },
    { label: "จำนวนโพสต์", now: k.posts, before: kp?.posts ?? null, f: num },
    { label: "วิวต่อโพสต์ (ค่ากลาง)", now: k.medianViews, before: kp?.medianViews ?? null, f: compact },
  ];
  const tv = [
    { ch: "One31", now: t.rating, before: tp?.rating ?? null },
    { ch: "GMM25", now: t.gmmRating, before: tp?.gmmRating ?? null },
  ];
  return (
    <div className="pt-kpis">
      {tiles.map((x) => (
        <div key={x.label} className="pi-card pt-kpi">
          <small>{x.label}</small>
          <b>{x.now === null ? "-" : <CountUp value={x.now} format={x.f} />}</b>
          <Growth value={change(x.now, x.before)} title={compareText} label="เทียบช่วงก่อน" />
        </div>
      ))}
      <div className="pi-card pt-kpi">
        <small>TV Rating เฉลี่ย</small>
        <div className="pt-tv2">
          {tv.map((x) => (
            <div key={x.ch}>
              <span className={`ps-chip ${x.ch === "GMM25" ? "gmm" : "one"}`}>{x.ch}</span>
              <b>{x.now === null ? "-" : <CountUp value={x.now} format={(v) => v.toFixed(3)} />}</b>
              <Growth value={change(x.now, x.before)} title={compareText} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Digital views per day against the TV audience of the episodes aired that day. */
export function DigitalVsTv({ cur, startDate, endDate }: { cur: RecordRow[]; startDate: string; endDate: string }) {
  const motion = useMotion();
  const data = useMemo(() => digitalVsTv(cur, startDate, endDate), [cur, startDate, endDate]);
  return (
    <article className="pi-card">
      <h3>แนวโน้ม Digital vs TV</h3>
      <p className="ps-muted">ยอดวิว Digital ตามวันที่ลงโพสต์ (แกนซ้าย) เทียบผู้ชม TV ของเทปที่ออกอากาศวันนั้น (แกนขวา)</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={24} />
          <YAxis yAxisId="d" tickFormatter={compact} tick={{ fontSize: 11 }} width={52} />
          <YAxis yAxisId="t" orientation="right" tickFormatter={compact} tick={{ fontSize: 11 }} width={52} />
          <Tooltip labelFormatter={(d) => fullDate(String(d))} formatter={(v, n) => [Number(v) ? num(Number(v)) : "-", n === "digital" ? "Digital (วิว)" : "TV (ผู้ชม)"]} />
          <Line yAxisId="d" type="monotone" dataKey="digital" stroke="#0757e8" strokeWidth={2.5} dot={false} isAnimationActive={motion} animationDuration={1100} />
          <Line yAxisId="t" type="monotone" dataKey={(d: { tv: number }) => d.tv || null} name="tv" stroke="#f59e0b" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={motion} animationDuration={1100} />
        </LineChart>
      </ResponsiveContainer>
      <div className="pi-legend static">
        <span>
          <i style={{ background: "#0757e8" }} />
          Digital
        </span>
        <span>
          <i style={{ background: "#f59e0b" }} />
          TV Audience
        </span>
      </div>
    </article>
  );
}

/** Each platform's share of the metric. */
export function PlatformShare({ cur, metric }: { cur: RecordRow[]; metric: PageMetric }) {
  const motion = useMotion();
  const list = useMemo(() => platformValues(cur, metric), [cur, metric]);
  const sum = list.reduce((a, x) => a + x.value, 0);
  const first = list[0];
  return (
    <article className="pi-card">
      <h3>สัดส่วนตามแพลตฟอร์ม</h3>
      <p className="ps-muted">ตาม{metricText(metric)}{metric === "er" ? " · ER เทียบกันเป็นสัดส่วนของผลรวม ER" : ""}</p>
      <div className="pt-donut">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={list} dataKey="value" nameKey="platform" innerRadius={62} outerRadius={94} paddingAngle={2} stroke="none" isAnimationActive={motion} startAngle={90} endAngle={-270}>
              {list.map((x) => (
                <Cell key={x.platform} fill={COLORS[x.platform]} />
              ))}
            </Pie>
            <Tooltip formatter={(v, n) => [`${metricFormat(metric)(Number(v))} (${sum ? pct(Number(v) / sum, 0) : "-"})`, String(n)]} />
          </PieChart>
        </ResponsiveContainer>
        {first && sum > 0 && (
          <div className="pt-donut-mid">
            <b>{pct(first.value / sum, 0)}</b>
            <small>
              {first.platform} · {metricText(metric)}
            </small>
          </div>
        )}
      </div>
      <div className="pi-legend static">
        {list.map((x) => (
          <span key={x.platform}>
            <i style={{ background: COLORS[x.platform] }} />
            {x.platform} {sum ? pct(x.value / sum, 0) : "-"}
          </span>
        ))}
      </div>
    </article>
  );
}

/** Platforms ranked by the metric; switching the metric re-sorts the bars. */
export function PlatformBars({ cur, metric }: { cur: RecordRow[]; metric: PageMetric }) {
  const list = useMemo(() => platformValues(cur, metric), [cur, metric]);
  const max = Math.max(0, ...list.map((x) => x.value));
  const f = metricFormat(metric);
  return (
    <article className="pi-card">
      <h3>แต่ละแพลตฟอร์ม</h3>
      <p className="ps-muted">เรียงตาม{metricText(metric)}</p>
      <ol className="pt-rank">
        {list.map((x) => (
          <li key={x.platform}>
            <span className="pt-rank-label">{x.platform}</span>
            <span className="pt-rank-bar">
              <span style={{ width: max ? `${(x.value / max) * 100}%` : 0, background: COLORS[x.platform] }} />
            </span>
            <b>{f(x.value)}</b>
          </li>
        ))}
      </ol>
    </article>
  );
}

/** The topic types with the most of the metric. */
export function TopTopics({ cur, metric }: { cur: RecordRow[]; metric: PageMetric }) {
  const list = useMemo(() => topTopics(cur, metric), [cur, metric]);
  const max = Math.max(0, ...list.map((x) => x.value));
  const f = metricFormat(metric);
  return (
    <article className="pi-card">
      <h3>Top 8 ประเด็น</h3>
      <p className="ps-muted">ประเภทเนื้อหาของโพสต์ Digital เรียงตาม{metricText(metric)}{metric === "er" ? " (อย่างน้อย 5 โพสต์)" : ""}</p>
      {list.length ? (
        <ol className="pt-rank">
          {list.map((x, i) => (
            <li key={x.topic}>
              <span className="pt-rank-label">
                <b className="pi-rank">{i + 1}</b> {x.topic}
              </span>
              <span className="pt-rank-bar">
                <span style={{ width: max ? `${(x.value / max) * 100}%` : 0, background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
              </span>
              <b>{f(x.value)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ps-muted">ไม่มีข้อมูลประเภทเนื้อหาในช่วงนี้</p>
      )}
    </article>
  );
}

function ChannelLines({ ch, source, rows, startDate, endDate }: { ch: TvChannel; source: CompetitorSource | undefined; rows: RecordRow[]; startDate: string; endDate: string }) {
  const motion = useMotion();
  const [focus, setFocus] = useState("");
  const trend = useMemo(() => (source ? competitorTrend(source.rows, ownRatings(rows, source.program, ch), "channel", startDate, endDate, "day") : null), [source, rows, ch, startDate, endDate]);
  const keys = trend ? [OWN_KEY, ...trend.series.map((s) => s.key)] : [];
  const colorOf = (k: string, i: number) => (k === OWN_KEY ? "#0757e8" : TOPIC_COLORS[i % TOPIC_COLORS.length]);
  return (
    <div>
      <span className={`ps-chip ${ch === "GMM25" ? "gmm" : "one"}`}>{ch}</span>
      {!trend || !trend.points.length ? (
        <p className="ps-muted">ไม่มีข้อมูลคู่แข่งของ {ch} ในช่วงนี้</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={trend.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                labelFormatter={(d) => fullDate(String(d))}
                formatter={(v, n, item) => {
                  const prog = (item?.payload as Record<string, string> | undefined)?.[`program:${String(n)}`];
                  return [`${Number(v).toFixed(3)}${prog ? ` · ${prog}` : ""}`, String(n)];
                }}
              />
              {keys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={colorOf(k, i)}
                  strokeWidth={k === OWN_KEY ? 3.2 : focus === k ? 3.2 : 1.8}
                  strokeOpacity={!focus || focus === k ? 1 : 0.15}
                  dot={false}
                  connectNulls
                  isAnimationActive={motion}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="pi-legend" onMouseLeave={() => setFocus("")}>
            {keys.map((k, i) => (
              <button key={k} type="button" onMouseEnter={() => setFocus(k)} onFocus={() => setFocus(k)} onBlur={() => setFocus("")}>
                <i style={{ background: colorOf(k, i) }} />
                {k === OWN_KEY ? `${k} (เรา)` : k}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** ถกไม่เถียง against the same-slot channels, One31 and GMM25 side by side, always both. */
export function CompetitorLines({ tvRows, startDate, endDate }: { tvRows: RecordRow[]; startDate: string; endDate: string }) {
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
  return (
    <article className="pi-card">
      <h3>Rating ถกไม่เถียง vs คู่แข่ง</h3>
      <p className="ps-muted">ช่องช่วงเวลาเดียวกัน จากไฟล์ TV · แสดงทั้ง 2 ช่องเสมอ · ชี้ชื่อในคำอธิบาย เส้นอื่นจะจางลง</p>
      {sources === null ? (
        <Skeleton lines={2} height={180} />
      ) : (
        <div className="ps-comp2">
          {(["One31", "GMM25"] as const).map((c) => (
            <ChannelLines key={c} ch={c} source={sourceOf(sources, c)} rows={tvRows} startDate={startDate} endDate={endDate} />
          ))}
        </div>
      )}
    </article>
  );
}

