"use client";
// รายงาน → Trending Hashtag: our posts' hashtags in the date range at the top, ranked by
// views, laid out as the Hashtag Report of output/platform-report-demo.html, with the full
// detail view per hashtag (lib/dashboard/trendingHashtags.ts). Filters at the top apply
// (program, VDO type, topic type, search, dates); the platform is picked here.
import { useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Hash, TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { creativeCenterUrl, hashtagDetail, periodsEnding, trendingHashtags } from "@/lib/dashboard/trendingHashtags";
import { WEEKDAYS, bestSlots, postingHeatmap } from "@/lib/dashboard/platformReport";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";
import { recordDownload } from "@/lib/auth/activity";

const PLATFORMS = ["ALL", "YouTube", "Facebook", "Instagram", "TikTok"] as const;
const SHOWN = 30;
const TOP = 10;
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
const thDate = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...o }).format(new Date(`${iso}T00:00:00Z`)) : "";
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const colorOf = (p: string) => PLATFORM_COLORS[p] || "#64748b";

/** Small line of the daily values. */
function Spark({ values, color = "#0757e8" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 74;
  const h = 22;
  const pts = values.map((v, i) => `${(1 + (i / Math.max(1, values.length - 1)) * (w - 2)).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="pi-spark-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  /** Rows passing the filters except platform and date. */
  rows: RecordRow[];
  allRows: RecordRow[];
  latestDate: string;
  /** The date range at the top, and the period it is compared with. */
  startDate: string;
  endDate: string;
  comparePeriod: { start: string; end: string } | null;
  /** Permission "download". */
  canDownload?: boolean;
}

export function TrendingHashtagsSection({ rows, allRows, latestDate, startDate, endDate, comparePeriod, canDownload = true }: Props) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [opened, setOpened] = useState<RecordRow | null>(null);

  const mine = useMemo(() => (platform === "ALL" ? rows : rows.filter((r) => r.platform === platform)), [rows, platform]);
  // The date range at the top; without one, the last 30 days of data. Compared with the period the filters compare with.
  const { cur, prev } = useMemo(() => {
    if (!startDate || !endDate) return periodsEnding(latestDate || new Date().toISOString().slice(0, 10), 30);
    const cur = { start: startDate, end: endDate };
    return { cur, prev: comparePeriod || periodsEnding(startDate, 1 + Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000)).prev };
  }, [startDate, endDate, comparePeriod, latestDate]);
  const trend = useMemo(() => trendingHashtags(mine, cur, prev, { hideCommon: true }), [mine, cur, prev]);
  const list = trend.items;
  const chosen = useMemo(() => list.find((x) => x.tag === pick) || list[0], [list, pick]);
  const chosenDetail = useMemo(() => (chosen ? hashtagDetail(mine, chosen.tag, cur) : null), [mine, chosen, cur]);
  const hiddenTags = useMemo(() => new Set(trend.hidden), [trend]);
  const bubbles = useMemo(() => (chosenDetail ? chosenDetail.related.filter((x) => !hiddenTags.has(x.tag)).slice(0, BUBBLE_AT.length) : []), [chosenDetail, hiddenTags]);
  const coMax = Math.max(1, ...bubbles.map((x) => x.posts));
  const split = chosen ? Object.entries(chosen.platforms).sort((a, b) => b[1] - a[1]) : [];
  const splitMax = Math.max(0, ...split.map(([, v]) => v));
  const maxViews = Math.max(1, ...list.slice(0, showAll ? SHOWN : TOP).map((x) => x.views));
  const barColor = platform === "ALL" ? "#0757e8" : colorOf(platform);
  const detail = useMemo(() => (selected ? hashtagDetail(mine, selected, cur) : null), [mine, selected, cur]);
  const slots = useMemo(() => (detail ? bestSlots(postingHeatmap(detail.rows)) : []), [detail]);

  function downloadCsv() {
    if (!detail || !selected) return;
    const cols = ["Date", "Platform", "Channel", "Program", "Topic", "Hashtags", "Views", "Likes", "Comments", "Shares", "URL"];
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = detail.rows.map((r) => [r.date, r.platform, r.channel, r.program, r.topic, r.hashtags, r.views, r.likes, r.comments, r.shares, r.url].map(cell).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + [cols.join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `hashtag-${selected.replace(/^#/, "")}-${cur.start}-${cur.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    recordDownload("csv-hashtag", a.download, detail.rows.length);
  }

  return (
    <section className="panel trending-hashtags" id="trending-hashtags">
      {opened && <ClipDetailPanel clip={opened} allRows={allRows} latestDate={latestDate} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>
            <TrendingUp size={18} /> Trending Hashtag
          </h2>
          <p className="growth-sub">
            hashtag ในโพสต์ของเรา · {thDate(cur.start)} – {thDate(cur.end)} เทียบ {thDate(prev.start)} – {thDate(prev.end)} · ตามตัวกรองด้านบน (รวมวันที่)
          </p>
        </div>
      </div>

      {!selected && (
        <article className="pi-card ht">
          <div className="ht-head">
            <div className="ht-seg" role="group" aria-label="แพลตฟอร์ม">
              {PLATFORMS.map((p) => (
                <button key={p} className={platform === p ? "on" : ""} onClick={() => setPlatform(p)}>
                  {p === "ALL" ? "รวมทุกแพลตฟอร์ม" : p}
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
                <b>{trend.posts ? pct(trend.withTags / trend.posts, 0) : "-"}</b>
              </div>
              <div title="โพสต์ที่มีหลายแท็กถูกนับในทุกแท็กที่มี">
                <small>วิวจากแท็ก 10 อันดับ</small>
                <b>{compact(list.slice(0, TOP).reduce((a, x) => a + x.views, 0))}</b>
              </div>
            </div>
          </div>
          {list.length === 0 ? (
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
                  <span>แนวโน้ม</span>
                </div>
                <div>
                  {(showAll ? list.slice(0, SHOWN) : list.slice(0, TOP)).map((x) => {
                    const move = x.prevRank === null ? null : x.prevRank - x.rank;
                    return (
                      <button type="button" key={x.tag} className={`ht-row${chosen?.tag === x.tag ? " sel" : ""}`} onClick={() => setPick(x.tag)}>
                        <span>{x.rank}</span>
                        <span className="tg" title={x.topicType}>
                          {x.tag}
                        </span>
                        {move === null ? (
                          <span className="mv" style={{ color: "#7c3aed" }}>
                            ใหม่
                          </span>
                        ) : move > 0 ? (
                          <span className="mv up">▲{move}</span>
                        ) : move < 0 ? (
                          <span className="mv down">▼{-move}</span>
                        ) : (
                          <span className="mv" style={{ color: "#94a3b8" }}>
                            ■
                          </span>
                        )}
                        <span className="n">{num(x.posts)}</span>
                        <span className="vb">
                          <div>
                            <span style={{ width: `${(x.views / maxViews) * 100}%`, background: barColor }} />
                          </div>
                          <b>{compact(x.views)}</b>
                        </span>
                        <span className="n">{pct(x.er, 1)}</span>
                        <Spark values={x.daily} color={barColor} />
                      </button>
                    );
                  })}
                </div>
                {list.length > TOP && (
                  <button type="button" className="ranking-more" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? "แสดง 10 อันดับ" : `ดูทั้งหมด ${Math.min(SHOWN, list.length)} hashtag`}
                  </button>
                )}
                <p className="ps-muted" style={{ marginTop: 8 }}>
                  กดแท็กเพื่อดูรายละเอียดทางขวา · ▲▼ = อันดับเทียบช่วงก่อน · ซ่อนแท็กของช่อง/รายการ เช่น #ถกไม่เถียง · แนวโน้ม = วิวของโพสต์ตามวันที่โพสต์
                </p>
              </div>
              {chosen && (
                <div className="ht-side">
                  <h2>{chosen.tag}</h2>
                  <p className="ps-muted">
                    {num(chosen.posts)} โพสต์ · วิวรวม {compact(chosen.views)} · ER {pct(chosen.er, 1)}
                  </p>
                  <h3>แยกตามแพลตฟอร์ม</h3>
                  {split.map(([p, v]) => (
                    <div key={p} className="ht-split" title={`${num(v)} วิว`}>
                      <span>{p}</span>
                      <div>
                        <span style={{ width: `${splitMax ? (v / splitMax) * 100 : 0}%`, background: colorOf(p) }} />
                      </div>
                      <b>{chosen.views ? pct(v / chosen.views, 0) : "-"}</b>
                    </div>
                  ))}
                  <h3 style={{ marginTop: 12 }}>แท็กที่ใช้คู่กันบ่อย</h3>
                  {bubbles.length ? (
                    <svg className="ht-bubbles" viewBox="0 0 360 200" role="img" aria-label="แท็กที่ใช้คู่กันบ่อย">
                      {bubbles.map((b, i) => {
                        const r = 16 + 26 * (b.posts / coMax);
                        const can = list.slice(0, showAll ? SHOWN : TOP).some((x) => x.tag === b.tag);
                        return (
                          <g
                            key={b.tag}
                            className="ht-bubble"
                            transform={`translate(${BUBBLE_AT[i][0]},${BUBBLE_AT[i][1]})`}
                            style={{ cursor: can ? "pointer" : "default", animationDelay: `${i * 60}ms` }}
                            onClick={() => can && setPick(b.tag)}
                          >
                            <title>{`${b.tag} · ใช้คู่กัน ${b.posts} โพสต์`}</title>
                            <circle r={r} fill="#0757e8" fillOpacity={0.12 + r / 160} />
                            <text textAnchor="middle" y={4} fontSize={r > 30 ? 12 : 10} fill="#0f1b31">
                              {b.tag}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    <p className="ps-muted">ไม่มีแท็กอื่นที่ใช้คู่กัน</p>
                  )}
                  <button type="button" className="trend-more ht-detail-btn" onClick={() => setSelected(chosen.tag)}>
                    ดูรายละเอียดทั้งหมด →
                  </button>
                </div>
              )}
            </div>
          )}
          <p className="audience-note">
            {num(trend.withTags)} จาก {num(trend.posts)} โพสต์ในช่วงนี้มี hashtag · วิว = ยอดสะสมล่าสุดของโพสต์ที่โพสต์ในช่วงนี้ · นับ hashtag ที่ใช้อย่างน้อย 2 โพสต์ · ซ่อน hashtag ของช่อง / รายการ / พิธีกร และที่อยู่ในโพสต์เกิน 60%
            {trend.hidden.length > 0 && ` (${trend.hidden.join(" ")})`} · ไม่ใช่เทรนด์ของทั้ง TikTok (ดูได้จากปุ่มในหน้ารายละเอียด)
          </p>
        </article>
      )}

      {selected && detail && (
        <div className="trend-detail">
          <div className="trend-detail-head">
            <button type="button" className="trend-back" onClick={() => setSelected(null)}>
              <ArrowLeft size={15} /> กลับไปรายการ
            </button>
            <h3>
              <Hash size={16} /> {selected.replace(/^#/, "")}
            </h3>
            <div className="trend-actions">
              <a className="trend-more" href={creativeCenterUrl(selected)} target="_blank" rel="noreferrer" title="เทรนด์ของ hashtag นี้ในทั้ง TikTok (ต้องล็อกอิน TikTok)">
                ดูใน TikTok Creative Center <ExternalLink size={12} />
              </a>
              {canDownload && (
                <button type="button" className="acc-export" onClick={downloadCsv}>
                  <Download size={14} /> CSV
                </button>
              )}
            </div>
          </div>

          <div className="yt-deep-cards">
            <article>
              <span>โพสต์</span>
              <strong>{num(detail.totals.posts)}</strong>
            </article>
            <article>
              <span>วิว</span>
              <strong>{compact(detail.totals.views)}</strong>
            </article>
            <article>
              <span>Like / Comment / Share</span>
              <strong>
                {compact(detail.totals.likes)} / {compact(detail.totals.comments)} / {compact(detail.totals.shares)}
              </strong>
            </article>
            <article>
              <span>ER</span>
              <strong>{pct(detail.totals.er, 2)}</strong>
            </article>
          </div>

          <article className="growth-table">
            <h3>รายวัน (ตามวันที่โพสต์)</h3>
            <div className="chart-md">
              <ResponsiveContainer>
                <ComposedChart data={detail.daily}>
                  <CartesianGrid vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => thDate(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="v" tickFormatter={compact} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="p" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(d) => thDate(String(d), { weekday: "short", day: "numeric", month: "short" })} formatter={(v, n) => [num(Number(v)), String(n)]} />
                  <Legend />
                  <Bar yAxisId="v" dataKey="views" name="วิว" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="p" type="monotone" dataKey="posts" name="โพสต์" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </article>

          <div className="platform-report-grid">
            <article className="growth-table">
              <h3>แยกแพลตฟอร์ม</h3>
              <table>
                <tbody>
                  {detail.byPlatform.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <b style={{ color: colorOf(p.name) }}>{p.name}</b>
                      </td>
                      <td className="num">{num(p.posts)} โพสต์</td>
                      <td className="num strong">{compact(p.views)} วิว</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 style={{ marginTop: 12 }}>แยกรายการ</h3>
              <table>
                <tbody>
                  {detail.byProgram.slice(0, 8).map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td className="num">{num(p.posts)} โพสต์</td>
                      <td className="num strong">{compact(p.views)} วิว</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
            <article className="growth-table">
              <h3>hashtag ที่ใช้คู่กันบ่อย</h3>
              {detail.related.length ? (
                <div className="trend-related">
                  {detail.related.map((r) => (
                    <button key={r.tag} type="button" onClick={() => setSelected(r.tag)} title="ดูรายละเอียด hashtag นี้">
                      {r.tag} <small>{r.posts}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="growth-notice">ไม่มี hashtag อื่นในโพสต์เหล่านี้</p>
              )}
              <h3 style={{ marginTop: 12 }}>วันและเวลาที่โพสต์แล้วได้ผลดี</h3>
              {slots.length ? (
                <p className="platform-slots">
                  {slots.map((s, i) => (
                    <span key={i}>
                      {WEEKDAYS[s.day]} {String(s.hour).padStart(2, "0")}:00 ({compact(s.medianViews)} วิว · {s.posts} โพสต์)
                    </span>
                  ))}
                </p>
              ) : (
                <p className="audience-note">โพสต์ยังไม่พอสรุป (ต้องมีอย่างน้อย 3 โพสต์ในวันและชั่วโมงเดียวกัน)</p>
              )}
            </article>
          </div>

          <article className="growth-table">
            <h3>คลิปที่วิวสูงสุด 10 อันดับ</h3>
            <ol className="search-clips">
              {detail.rows.slice(0, 10).map((r, i) => (
                <li key={`${r.url || r.topic}-${i}`}>
                  <span className="ranking-title">
                    <button type="button" className="clip-open" onClick={() => setOpened(r)} title="วิเคราะห์คลิปนี้">
                      {r.topic || "ไม่ระบุประเด็น"}
                    </button>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </span>
                  <small>
                    <b style={{ color: colorOf(r.platform) }}>{r.platform}</b> · {thDate(r.date)} · {compact(r.views)} วิว · {num(r.likes)} Like · {num(r.comments)} Comment
                  </small>
                </li>
              ))}
            </ol>
          </article>
        </div>
      )}
    </section>
  );
}
