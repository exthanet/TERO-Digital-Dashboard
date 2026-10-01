"use client";
// Advanced → คุณภาพคลิป: share of each clip watched and engagement rate, per
// platform, for clips posted in the report range (same rows as the report pages).
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import {
  QUALITY_MIN_VIEWS,
  lengthVsWatched,
  platformQuality,
  rankQuality,
  type QualityMetric,
  type RankedQualityClip,
} from "@/lib/dashboard/quality";
import { Growth } from "@/components/dashboard/shared/Growth";

const thDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "";
// Length axis on a log scale (computed here: recharts' own log scale draws no points).
const LENGTH_TICKS = [15, 30, 60, 180, 600, 1800, 3600, 7200];
const lengthLabel = (sec: number) => (sec < 60 ? `${Math.round(sec)} วิ` : sec < 3600 ? `${Math.round(sec / 60)} นาที` : `${Math.round(sec / 360) / 10} ชม.`);
const pct1 = (v: number | null) => (v === null ? "-" : `${(v * 100).toFixed(1)}%`);
const secs = (v: number | null) => (v === null ? "-" : v >= 60 ? `${Math.floor(v / 60)} นาที ${Math.round(v % 60)} วินาที` : `${v.toFixed(1)} วินาที`);

interface Props {
  /** Clips posted in the report range that pass the filters. */
  rows: RecordRow[];
  /** Same filters without the date: the compare range is taken from these. */
  allRows: RecordRow[];
  startDate: string;
  endDate: string;
  comparePeriod: { start: string; end: string } | null;
}

function indexText(x: RankedQualityClip) {
  if (x.index === null) return "ข้อมูลไม่พอเทียบค่ากลาง";
  return x.index >= 1 ? `${x.index.toFixed(1)}× ของค่ากลาง` : `${Math.round(x.index * 100)}% ของค่ากลาง`;
}

function QualityList({ items, metric, tone }: { items: RankedQualityClip[]; metric: QualityMetric; tone: "best" | "worst" }) {
  if (!items.length) return <p className="ranking-empty">ข้อมูลยังไม่พอ</p>;
  return (
    <ol className={`ranking-list ${tone}`}>
      {items.map((x, i) => (
        <li key={`${x.row.contentId || x.row.url}-${i}`}>
          <b className="ranking-no">{i + 1}</b>
          <div className="ranking-body">
            <a href={x.row.url || undefined} target="_blank" rel="noreferrer" title={x.row.topic}>
              {x.row.topic || "ไม่ระบุประเด็น"}
            </a>
            <small>
              <span className="tag">{x.row.vdoType}</span> {compact(x.row.views)} วิว
              {metric === "watched" && ` · ยาว ${secs(x.row.videoLengthSec)}`}
            </small>
          </div>
          <div className="ranking-metric">
            <strong>{metric === "watched" ? pct1(x.value) : `${(x.value * 100).toFixed(2)}%`}</strong>
            <small className={x.index !== null && x.index < 1 ? "down" : "up"}>{indexText(x)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function QualitySection({ rows, allRows, startDate, endDate, comparePeriod }: Props) {
  const digital = useMemo(() => rows.filter((r) => r.platform !== "TV"), [rows]);
  const cards = useMemo(() => platformQuality(digital), [digital]);
  const prev = useMemo(() => {
    if (!comparePeriod) return new Map<string, ReturnType<typeof platformQuality>[number]>();
    const list = allRows.filter((r) => r.platform !== "TV" && r.date >= comparePeriod.start && r.date <= comparePeriod.end);
    return new Map(platformQuality(list).map((p) => [p.platform, p]));
  }, [allRows, comparePeriod]);
  const points = useMemo(() => lengthVsWatched(digital), [digital]);
  const hasWatch = cards.some((c) => c.watched !== null);

  const [metric, setMetric] = useState<QualityMetric>("watched");
  const rankable = cards.filter((c) => (metric === "watched" ? c.watched !== null : c.views > 0)).map((c) => c.platform);
  const [pickedPlatform, setPickedPlatform] = useState("");
  const platform = rankable.includes(pickedPlatform) ? pickedPlatform : rankable[0] || "";
  const ranking = useMemo(() => (platform ? rankQuality(digital, platform, metric) : null), [digital, platform, metric]);

  const change = (a: number | null, b: number | null | undefined) => (a !== null && b ? (a - b) / b : null);
  const compareText = comparePeriod ? `เทียบกับคลิปที่โพสต์ ${thDate(comparePeriod.start)} – ${thDate(comparePeriod.end)}` : "";

  return (
    <section className="panel growth-panel" id="quality">
      <div className="panel-head">
        <div>
          <h2>คุณภาพคลิป: คนดูนานแค่ไหน และมีส่วนร่วมเท่าไร</h2>
          <p className="growth-sub">
            คลิปที่โพสต์ในช่วง {thDate(startDate)} – {thDate(endDate)} ตามตัวกรองด้านบน · แยกแต่ละแพลตฟอร์ม
            เพราะแต่ละแพลตฟอร์มนับวิวต่างกัน จึงไม่รวมเป็นตัวเลขเดียว
          </p>
        </div>
      </div>

      {!hasWatch && digital.length > 0 && (
        <p className="growth-notice warn">
          ยังไม่มีข้อมูลเวลาดูของคลิปในช่วงนี้ · ข้อมูลจะเริ่มมีหลัง sync รอบถัดไป (คลิปเก่าต้องเติมข้อมูลย้อนหลัง)
        </p>
      )}
      {!digital.length && <p className="growth-notice">ไม่มีคลิปออนไลน์ในช่วงนี้</p>}

      <div className="quality-cards">
        {cards.map((c) => {
          const p = prev.get(c.platform);
          return (
            <article key={c.platform} className="quality-card" style={{ borderTopColor: PLATFORM_COLORS[c.platform] || "#64748b" }}>
              <header>
                <b>{c.platform}</b>
                <small>
                  {num(c.clips)} คลิป · {compact(c.views)} วิว
                </small>
              </header>
              <div className="quality-main">
                <div>
                  <p>คนดูเฉลี่ย</p>
                  {c.watched !== null ? (
                    <>
                      <strong>{pct1(c.watched)}</strong>
                      <span>ของความยาวคลิป</span>
                      <Growth value={change(c.watched, p?.watched)} title={compareText} />
                    </>
                  ) : (
                    <em>API ไม่มีข้อมูลเวลาดู</em>
                  )}
                </div>
                <div>
                  <p>Engagement Rate</p>
                  <strong>{(c.er * 100).toFixed(2)}%</strong>
                  <span>ไลก์+คอมเมนต์+แชร์ ÷ วิว</span>
                  <Growth value={change(c.er, p?.er)} title={compareText} />
                </div>
              </div>
              {c.watched !== null && (
                <p className="quality-line">
                  ดูเฉลี่ย {secs(c.avgWatchSec)} ต่อวิว · มีข้อมูลเวลาดู {num(c.watchClips)} จาก {num(c.clips)} คลิป
                </p>
              )}
              {c.kept !== null && (
                <p className="quality-line">
                  Reels ที่ไม่ถูกปัดทิ้งช่วงแรก: <b>{pct1(c.kept)}</b>
                </p>
              )}
              {c.platform === "Facebook" && c.watched !== null && (
                <p className="quality-line muted">เวลาดูมีเฉพาะ Reels · โพสต์ปกตินับวิวเป็นจำนวนการเห็น ER จึงต่ำกว่าแพลตฟอร์มอื่น</p>
              )}
              <table className="quality-formats">
                <thead>
                  <tr>
                    <th>รูปแบบ</th>
                    <th className="num">คลิป</th>
                    <th className="num">ดูเฉลี่ย</th>
                    <th className="num">ER</th>
                  </tr>
                </thead>
                <tbody>
                  {c.formats.map((f) => (
                    <tr key={f.vdoType}>
                      <td>{f.vdoType}</td>
                      <td className="num">{num(f.clips)}</td>
                      <td className="num">{pct1(f.watched)}</td>
                      <td className="num">{(f.er * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>

      {points.length > 0 && (
        <article className="growth-chart">
          <h3>ความยาวคลิป × % ที่คนดู (แต่ละจุด = 1 คลิป ที่มี {QUALITY_MIN_VIEWS}+ วิว)</h3>
          <div className="growth-chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="lengthLog"
                  name="ความยาว"
                  domain={[Math.log10(10), Math.log10(Math.max(60, ...points.map((p) => p.lengthSec)) * 1.1)]}
                  ticks={LENGTH_TICKS.filter((t) => t <= Math.max(60, ...points.map((p) => p.lengthSec)) * 1.1).map((t) => Math.log10(t))}
                  tickFormatter={(v: number) => lengthLabel(10 ** v)}
                  fontSize={11}
                />
                <YAxis type="number" dataKey="watchedPct" name="% ที่ดู" unit="%" fontSize={11} width={48} />
                <ZAxis type="number" dataKey="views" range={[18, 18]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    const d = payload?.[0]?.payload as ReturnType<typeof lengthVsWatched>[number] | undefined;
                    if (!d) return null;
                    return (
                      <div className="quality-tip">
                        <b>{d.topic.slice(0, 80)}</b>
                        <span>
                          {d.platform} · ยาว {secs(d.lengthSec)} · ดูเฉลี่ย {d.watchedPct}% · {num(d.views)} วิว
                        </span>
                      </div>
                    );
                  }}
                />
                <Legend />
                {[...new Set(points.map((p) => p.platform))].map((pl) => (
                  <Scatter key={pl} name={pl} data={points.filter((p) => p.platform === pl)} fill={PLATFORM_COLORS[pl] || "#64748b"} fillOpacity={0.55} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="quality-line muted">มากกว่า 100% = คนดูวนซ้ำ (พบบ่อยใน Shorts / Reels)</p>
        </article>
      )}

      {ranking && (
        <article className="growth-table">
          <div className="quality-rank-head">
            <h3>คลิปเด่น / คลิปที่ควรปรับ ({num(ranking.total)} คลิปที่มี {QUALITY_MIN_VIEWS}+ วิว)</h3>
            <div className="ranking-controls">
              <div className="segmented">
                <button className={metric === "watched" ? "active" : ""} onClick={() => setMetric("watched")}>
                  ดูนาน
                </button>
                <button className={metric === "er" ? "active" : ""} onClick={() => setMetric("er")}>
                  Engagement Rate
                </button>
              </div>
              <div className="segmented">
                {rankable.map((pl) => (
                  <button key={pl} className={platform === pl ? "active" : ""} onClick={() => setPickedPlatform(pl)}>
                    {pl}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="quality-rank-grid">
            <div>
              <h4>สูงสุด</h4>
              <QualityList items={ranking.best} metric={metric} tone="best" />
            </div>
            <div>
              <h4>ต่ำสุด</h4>
              <QualityList items={ranking.worst} metric={metric} tone="worst" />
            </div>
          </div>
        </article>
      )}

      <p className="ai-note growth-note">
        ที่มา: ค่าดิบจาก API ผ่าน Metricool (ไม่มีการปรับ) · % ที่ดู = เวลาดูเฉลี่ยต่อวิว ÷ ความยาวคลิป ถ่วงน้ำหนักด้วยจำนวนวิว ·
        YouTube = Average view duration · Facebook Reels = Average time watched · Instagram Reels = Average watch time ·
        TikTok และโพสต์ Facebook ปกติยังไม่มีข้อมูลเวลาดูจาก API · ER ใช้สูตรเดียวกับการ์ด KPI · ค่ากลาง = มัธยฐานของคลิปรูปแบบเดียวกันในช่วงนี้
      </p>
    </section>
  );
}
