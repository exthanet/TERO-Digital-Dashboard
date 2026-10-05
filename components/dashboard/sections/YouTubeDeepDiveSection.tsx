"use client";
// Advanced → YouTube Deep Dive: retention & hook, engagement, SEO & keywords and
// revenue per video type from YouTube Analytics (lib/dashboard/ytDeepDive.ts),
// for the YouTube clips on the page (filters at the top). Admins only.
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { track } from "@/lib/loadingBar";
import { loadYtAnalytics } from "@/lib/ytAnalyticsData";
import {
  CONTENT_TYPE_LABEL,
  TRAFFIC_LABEL,
  groupBy,
  joinVideos,
  keywordRelevance,
  quadrants,
  searchGaps,
  type DeepItem,
  type YtDeepDiveData,
} from "@/lib/dashboard/ytDeepDive";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";

const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v || 0);
const pct = (v: number | null, digits = 1) => (v === null ? "-" : `${(v * 100).toFixed(digits)}%`);
const thTime = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "-");

type Tab = "retention" | "engagement" | "seo" | "revenue" | "ctr";
const TABS: { key: Tab; label: string }[] = [
  { key: "retention", label: "Retention & Hook" },
  { key: "engagement", label: "Engagement" },
  { key: "seo", label: "SEO & Keyword" },
  { key: "revenue", label: "Revenue" },
  { key: "ctr", label: "Thumbnail CTR" },
];
const QUADRANT = {
  formula: { label: "⭐ สูตรที่ใช่", hint: "คนหยุดดูและดูต่อ → ทำซ้ำ ขยายผล" },
  weakBody: { label: "Hook ดี เนื้อหาไม่ส่ง", hint: "คนหยุดดูแต่ไม่ดูต่อ → ตัดให้สั้น เข้าเรื่องเร็ว" },
  weakHook: { label: "เนื้อหาดี Hook ไม่ดึง", hint: "คนที่ดูชอบ แต่หลายคนปัดทิ้ง → ปรับ 3 วินาทีแรก ชื่อ ภาพปก" },
  drop: { label: "ไม่ได้ผล", hint: "ทั้งหยุดดูและดูต่อต่ำกว่าค่ากลาง → เลิกหรือหามุมใหม่" },
} as const;

interface Props {
  /** Clips posted in the report range that pass the filters. */
  rows: RecordRow[];
  /** Every row, for the clip analysis panel. */
  allRows: RecordRow[];
  latestDate: string;
}

function ClipLink({ x, onOpen }: { x: DeepItem; onOpen: (r: RecordRow) => void }) {
  return (
    <span className="growth-clip-title">
      <button type="button" className="clip-open" onClick={() => onOpen(x.row)} title="วิเคราะห์คลิปนี้">
        {x.row.topic || x.v.id}
      </button>
      <a href={`https://www.youtube.com/watch?v=${x.v.id}`} target="_blank" rel="noreferrer" aria-label="เปิดคลิป">
        <ExternalLink size={12} />
      </a>
    </span>
  );
}

export function YouTubeDeepDiveSection({ rows, allRows, latestDate }: Props) {
  const [data, setData] = useState<YtDeepDiveData | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("retention");
  const [opened, setOpened] = useState<RecordRow | null>(null);
  const [win, setWin] = useState<"d28" | "d90">("d28");
  const [curveId, setCurveId] = useState("");

  useEffect(() => {
    track(loadYtAnalytics())
      .then(setData)
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  const items = useMemo(() => (data ? joinVideos(data, rows) : []), [data, rows]);
  const quad = useMemo(() => quadrants(items), [items]);
  const byFormat = useMemo(() => groupBy(items, (x) => x.format), [items]);
  const byType = useMemo(() => groupBy(items, (x) => x.row.vdoType), [items]);
  const byTopic = useMemo(() => groupBy(items, (x) => x.row.topicType), [items]);
  const ytRows = rows.filter((r) => r.platform === "YouTube").length;

  const curves = useMemo(() => {
    if (!data) return [];
    const onPage = new Map(items.map((x) => [x.v.id, x]));
    return data.retention.filter((c) => onPage.has(c.id)).map((c) => ({ ...c, item: onPage.get(c.id)! }));
  }, [data, items]);
  const curve = curves.find((c) => c.id === curveId) || curves[0];

  const window = data?.windows?.[win];
  const trafficTotal = window ? window.traffic.reduce((a, t) => a + t.views, 0) : 0;
  const gaps = useMemo(() => (window ? searchGaps(window.searchTerms, items.map((x) => x.row.topic)).slice(0, 10) : []), [window, items]);
  const relevance = useMemo(
    () =>
      data
        ? items
            .filter((x) => data.search[x.v.id]?.length)
            .map((x) => {
              const terms = data.search[x.v.id];
              const total = Object.values(x.v.traffic || {}).reduce((a, n) => a + n, 0);
              return { x, terms, searchShare: total ? (x.v.traffic?.YT_SEARCH || 0) / total : null, relevance: keywordRelevance(x.row.topic, terms) };
            })
            .sort((a, b) => (b.x.v.traffic?.YT_SEARCH || 0) - (a.x.v.traffic?.YT_SEARCH || 0))
            .slice(0, 15)
        : [],
    [data, items],
  );

  const totals = useMemo(() => {
    const views = items.reduce((a, x) => a + x.v.views, 0);
    const revenue = items.reduce((a, x) => a + x.v.revenue, 0);
    return { views, revenue, rpm: views ? (revenue / views) * 1000 : 0 };
  }, [items]);

  return (
    <section className="panel growth-panel yt-deep" id="youtube-deep-dive">
      {opened && <ClipDetailPanel clip={opened} allRows={allRows} latestDate={latestDate} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>
            <MonitorPlay size={18} /> YouTube Deep Dive
          </h2>
          <p className="growth-sub">
            ข้อมูลจาก YouTube Analytics (ช่อง terodigital ผ่าน CMS) · คลิป YouTube ตามตัวกรองด้านบน · อัปเดต {thTime(data?.updatedAt || "")} · ยอดตลอดอายุคลิป
          </p>
        </div>
      </div>

      <div className="segmented yt-deep-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="growth-notice warn">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {data === undefined && !error && <p className="growth-notice">กำลังโหลดข้อมูล YouTube Analytics…</p>}
      {data === null && <p className="growth-notice">ยังไม่มีข้อมูล · ระบบเริ่มเก็บจาก sync รอบถัดไป</p>}
      {data && (
        <p className="growth-notice">
          พบข้อมูล {num(items.length)} จาก {num(ytRows)} คลิป YouTube ในช่วงนี้
          {ytRows > items.length && " · คลิปที่ไม่อยู่ในช่อง terodigital หรือยังไม่มีข้อมูลจะไม่แสดง"}
        </p>
      )}

      {data && tab === "retention" && (
        <>
          <div className="yt-deep-cards">
            <article>
              <span>Hook rate ของ Shorts (ค่ากลาง)</span>
              <strong>{pct(quad.medianHook)}</strong>
              <small>คนที่ดูต่อ ÷ คนที่เห็น (ไม่ปัดทิ้ง)</small>
            </article>
            <article>
              <span>ดูเฉลี่ย · Shorts</span>
              <strong>{byFormat.find((g) => g.name === "Shorts")?.holdPct?.toFixed(0) ?? "-"}%</strong>
              <small>เกิน 100% = มีคนดูวนซ้ำ</small>
            </article>
            <article>
              <span>ดูเฉลี่ย · วิดีโอยาว</span>
              <strong>{byFormat.find((g) => g.name === "Video")?.holdPct?.toFixed(0) ?? "-"}%</strong>
              <small>ของความยาวคลิป (ค่ากลาง)</small>
            </article>
            <article>
              <span>Shorts ที่มีคนดูวนซ้ำ</span>
              <strong>{pct(quad.items.length ? quad.items.filter((x) => x.holdPct > 100).length / quad.items.length : null, 0)}</strong>
              <small>ดูเฉลี่ยเกิน 100%</small>
            </article>
          </div>

          <div className="yt-deep-grid">
            <article className="yt-deep-box">
              <h3>Shorts: Hook × ดูต่อ</h3>
              <p className="growth-hint">เส้นประ = ค่ากลางของ Shorts ในช่วงนี้ · จุดใหญ่ = วิวมาก · แกนตั้งตัดที่ 300% (คลิปสั้นมากที่ดูวนหลายรอบอยู่ขอบบน)</p>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke="#eef2f8" />
                    <XAxis type="number" dataKey="hook" name="Hook" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <YAxis type="number" dataKey="hold" name="ดูเฉลี่ย" unit="%" tick={{ fontSize: 11 }} width={44} domain={[0, 300]} allowDataOverflow />
                    <ZAxis type="number" dataKey="views" range={[20, 260]} name="วิว" />
                    <Tooltip
                      formatter={(v, name) => [name === "วิว" ? num(Number(v)) : `${Number(v).toFixed(1)}%`, String(name)]}
                      labelFormatter={() => ""}
                    />
                    {quad.medianHook !== null && <ReferenceLine x={quad.medianHook * 100} stroke="#94a3b8" strokeDasharray="4 3" />}
                    {quad.medianHold !== null && <ReferenceLine y={quad.medianHold} stroke="#94a3b8" strokeDasharray="4 3" />}
                    <Scatter data={quad.items.map((x) => ({ hook: x.hookRate! * 100, hold: x.holdPct, views: x.v.views }))} fill="#ef4444" fillOpacity={0.55} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="yt-deep-box">
              <h3>แบ่ง 4 กลุ่ม</h3>
              <ul className="yt-quad">
                {(Object.keys(QUADRANT) as (keyof typeof QUADRANT)[]).map((k) => {
                  const list = quad.items.filter((x) => x.quadrant === k).sort((a, b) => b.v.views - a.v.views);
                  return (
                    <li key={k} className={`q-${k}`}>
                      <b>
                        {QUADRANT[k].label} · {num(list.length)} คลิป
                      </b>
                      <small>{QUADRANT[k].hint}</small>
                      {list.slice(0, 2).map((x) => (
                        <ClipLink key={x.v.id} x={x} onOpen={setOpened} />
                      ))}
                    </li>
                  );
                })}
              </ul>
            </article>
          </div>

          {curve && (
            <article className="yt-deep-box">
              <h3>กราฟการดูต่อ (Retention)</h3>
              <p className="growth-hint">
                เส้นน้ำเงิน = สัดส่วนคนดู ณ จุดนั้นของคลิป (เกิน 1 = มีคนย้อนดู) · เส้นส้ม = เทียบคลิปความยาวใกล้กันบน YouTube (0.5 = ค่ากลาง สูงกว่าคือดีกว่า)
              </p>
              <select className="yt-curve-pick" value={curve.id} onChange={(e) => setCurveId(e.target.value)}>
                {curves.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.item.row.topic || c.id).slice(0, 80)} · {compact(c.item.v.views)} วิว
                  </option>
                ))}
              </select>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={curve.points.map((p) => ({ at: Math.round(p.at * 100), watch: p.watch, relative: p.relative }))}>
                    <CartesianGrid vertical={false} stroke="#eef2f8" />
                    <XAxis dataKey="at" unit="%" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip labelFormatter={(v) => `ช่วง ${v}% ของคลิป`} />
                    <Legend />
                    <ReferenceLine y={0.5} stroke="#fdba74" strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="watch" name="สัดส่วนคนดู" stroke="#0757e8" strokeWidth={2.4} dot={false} />
                    <Line type="monotone" dataKey="relative" name="เทียบคลิปใกล้กัน" stroke="#ea580c" strokeWidth={1.8} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          )}

          <article className="growth-table">
            <h3>Shorts เรียงตาม Hook rate</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>คลิป</th>
                    <th className="num">วิว</th>
                    <th className="num">Hook rate</th>
                    <th className="num">ดูเฉลี่ย</th>
                    <th className="num">วินาที</th>
                  </tr>
                </thead>
                <tbody>
                  {[...quad.items].sort((a, b) => b.hookRate! - a.hookRate!).slice(0, 15).map((x) => (
                    <tr key={x.v.id}>
                      <td className="growth-clip"><ClipLink x={x} onOpen={setOpened} /></td>
                      <td className="num">{num(x.v.views)}</td>
                      <td className="num strong">{pct(x.hookRate)}</td>
                      <td className="num">{x.holdPct.toFixed(0)}%</td>
                      <td className="num">{num(x.v.avgViewSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {data && tab === "engagement" && (
        <>
          <article className="growth-table">
            <h3>Engagement แยกตาม VDO Type</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>VDO Type</th>
                    <th className="num">คลิป</th>
                    <th className="num">วิว</th>
                    <th className="num">ER</th>
                    <th className="num">Comment / 1K</th>
                    <th className="num">Share / 1K</th>
                    <th className="num">ผู้ติดตามเพิ่ม / 1K</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map((g) => (
                    <tr key={g.name}>
                      <td>{g.name}</td>
                      <td className="num">{num(g.videos)}</td>
                      <td className="num">{compact(g.views)}</td>
                      <td className="num strong">{pct(g.er, 2)}</td>
                      <td className="num">{g.commentsPer1k.toFixed(2)}</td>
                      <td className="num">{g.sharesPer1k.toFixed(2)}</td>
                      <td className="num">{g.subsPer1k.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="growth-table">
            <h3>คลิปที่ได้ผู้ติดตามใหม่มากที่สุด (ต่อ 1,000 วิว · อย่างน้อย 10,000 วิว)</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>คลิป</th>
                    <th className="num">วิว</th>
                    <th className="num">ผู้ติดตามเพิ่ม</th>
                    <th className="num">ต่อ 1K วิว</th>
                    <th className="num">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((x) => x.v.views >= 10000)
                    .sort((a, b) => b.v.subs / b.v.views - a.v.subs / a.v.views)
                    .slice(0, 10)
                    .map((x) => (
                      <tr key={x.v.id}>
                        <td className="growth-clip"><ClipLink x={x} onOpen={setOpened} /></td>
                        <td className="num">{num(x.v.views)}</td>
                        <td className="num">{num(x.v.subs)}</td>
                        <td className="num strong">{((x.v.subs / x.v.views) * 1000).toFixed(2)}</td>
                        <td className="num">{pct(x.er, 2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {data && tab === "seo" && (
        <>
          <div className="segmented" style={{ marginBottom: 10 }}>
            <button className={win === "d28" ? "active" : ""} onClick={() => setWin("d28")}>28 วันล่าสุด</button>
            <button className={win === "d90" ? "active" : ""} onClick={() => setWin("d90")}>90 วันล่าสุด</button>
          </div>
          {window ? (
            <div className="yt-deep-grid">
              <article className="yt-deep-box">
                <h3>คนเจอคลิปจากที่ไหน (ทั้งช่อง)</h3>
                <p className="growth-hint">{window.start} → {window.end}</p>
                <ul className="yt-bars">
                  {window.traffic.slice(0, 9).map((t) => (
                    <li key={t.source}>
                      <span>{TRAFFIC_LABEL[t.source] || t.source}</span>
                      <i style={{ width: `${trafficTotal ? (t.views / trafficTotal) * 100 : 0}%` }} />
                      <b>{pct(trafficTotal ? t.views / trafficTotal : 0)}</b>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="yt-deep-box">
                <h3>คำค้นที่พาคนมาเจอ (ทั้งช่อง)</h3>
                <ol className="yt-terms">
                  {window.searchTerms.slice(0, 12).map((t) => (
                    <li key={t.term}>
                      <span>{t.term}</span>
                      <b>{num(t.views)}</b>
                    </li>
                  ))}
                </ol>
                {gaps.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 10 }}>คำที่คนค้น แต่ยังไม่มีคลิปชื่อตรงในช่วงนี้</h3>
                    <p className="growth-hint">ไม่นับชื่อรายการ · โอกาสทำคลิปหรือใส่คำนี้ในชื่อ / คำอธิบาย</p>
                    <div className="yt-gaps">
                      {gaps.map((g) => (
                        <span key={g.term}>
                          {g.term} <b>{compact(g.views)}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </article>
            </div>
          ) : (
            <p className="growth-notice">ยังไม่มีข้อมูลระดับช่อง</p>
          )}
          <article className="growth-table">
            <h3>Keyword relevance: คำค้นตรงกับชื่อคลิปแค่ไหน</h3>
            <p className="growth-hint">คลิปที่มีคนค้นเจอมากที่สุด · “ตรงกับชื่อ” = สัดส่วนวิวจากคำค้นที่ทุกคำอยู่ในชื่อคลิป · ต่ำ = คนหาเจอด้วยคำที่ชื่อคลิปไม่มี (ควรใส่ในชื่อ / คำอธิบาย)</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>คลิป</th>
                    <th className="num">วิวจากการค้นหา</th>
                    <th className="num">สัดส่วนจากการค้นหา</th>
                    <th className="num">ตรงกับชื่อ</th>
                    <th>คำค้นหลัก</th>
                  </tr>
                </thead>
                <tbody>
                  {relevance.map(({ x, terms, searchShare, relevance: r }) => (
                    <tr key={x.v.id}>
                      <td className="growth-clip"><ClipLink x={x} onOpen={setOpened} /></td>
                      <td className="num">{num(x.v.traffic?.YT_SEARCH || 0)}</td>
                      <td className="num">{pct(searchShare)}</td>
                      <td className={`num strong ${r !== null && r < 0.3 ? "down" : ""}`}>{pct(r, 0)}</td>
                      <td className="yt-term-cell">{terms.slice(0, 3).map((t) => t.term).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      {data && tab === "revenue" && (
        <>
          <div className="yt-deep-cards">
            <article>
              <span>รายได้คลิปในช่วงนี้ (ตลอดอายุคลิป)</span>
              <strong>{usd(totals.revenue)}</strong>
              <small>{num(items.length)} คลิป · USD ตามที่ YouTube รายงาน</small>
            </article>
            <article>
              <span>RPM รวม</span>
              <strong>{usd(totals.rpm)}</strong>
              <small>รายได้ต่อ 1,000 วิว</small>
            </article>
            {byFormat.map((g) => (
              <article key={g.name}>
                <span>RPM · {g.name}</span>
                <strong>{usd(g.rpm)}</strong>
                <small>{usd(g.revenue)} จาก {compact(g.views)} วิว</small>
              </article>
            ))}
          </div>
          {data.windows && (
            <article className="growth-table">
              <h3>รายได้ทั้งช่องตามประเภทเนื้อหา ({data.windows.d28.start} → {data.windows.d28.end})</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th className="num">วิว</th>
                      <th className="num">รายได้</th>
                      <th className="num">RPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.windows.d28.contentType.filter((t) => t.views > 0 || t.revenue > 0).map((t) => (
                      <tr key={t.type}>
                        <td>{CONTENT_TYPE_LABEL[t.type] || t.type}</td>
                        <td className="num">{num(t.views)}</td>
                        <td className="num strong">{usd(t.revenue)}</td>
                        <td className="num">{usd(t.views ? (t.revenue / t.views) * 1000 : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
          <div className="yt-deep-grid">
            {[{ title: "RPM ตาม VDO Type", list: byType }, { title: "RPM ตาม Topic Type", list: byTopic }].map(({ title, list }) => (
              <article key={title} className="growth-table">
                <h3>{title}</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>กลุ่ม</th>
                        <th className="num">คลิป</th>
                        <th className="num">รายได้</th>
                        <th className="num">RPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...list].sort((a, b) => b.revenue - a.revenue).map((g) => (
                        <tr key={g.name}>
                          <td>{g.name}</td>
                          <td className="num">{num(g.videos)}</td>
                          <td className="num">{usd(g.revenue)}</td>
                          <td className="num strong">{usd(g.rpm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
          <article className="growth-table">
            <h3>คลิปทำรายได้สูงสุด</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>คลิป</th>
                    <th className="num">วิว</th>
                    <th className="num">รายได้</th>
                    <th className="num">RPM</th>
                    <th className="num">CPM</th>
                  </tr>
                </thead>
                <tbody>
                  {[...items].sort((a, b) => b.v.revenue - a.v.revenue).slice(0, 15).map((x) => (
                    <tr key={x.v.id}>
                      <td className="growth-clip"><ClipLink x={x} onOpen={setOpened} /></td>
                      <td className="num">{num(x.v.views)}</td>
                      <td className="num strong">{usd(x.v.revenue)}</td>
                      <td className="num">{usd(x.rpm)}</td>
                      <td className="num">{x.v.cpm ? usd(x.v.cpm) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <p className="audience-note">รายได้เป็นค่าประมาณจาก YouTube (USD) อาจต่างจากยอดที่ได้รับจริงหลังหักส่วนแบ่ง/ภาษี · Shorts ได้ส่วนแบ่งจากกองกลางของ Shorts จึงมักไม่มี CPM รายคลิป</p>
        </>
      )}

      {tab === "ctr" && (
        <p className="growth-notice">
          ระบบเริ่มขอรายงาน CTR ภาพปกจาก YouTube Reporting API แล้ว (5 ต.ค. 2569) · ข้อมูลชุดแรกจะมาภายใน 1–2 วัน แล้วแท็บนี้และเมนู Thumbnail จะแสดง
          จำนวนครั้งที่เห็นภาพปกและ CTR รายคลิป
        </p>
      )}
    </section>
  );
}
