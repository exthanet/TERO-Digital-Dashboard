"use client";
// รายงาน → Trending Hashtag: our posts' hashtags ranked for 7 / 30 / 90 days, with a
// detail view per hashtag (lib/dashboard/trendingHashtags.ts). Filters at the top apply
// (program, VDO type, topic type, search); the platform and the period are picked here.
import { useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Hash, TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { creativeCenterUrl, hashtagDetail, periodsEnding, trendingHashtags, type TrendItem } from "@/lib/dashboard/trendingHashtags";
import { WEEKDAYS, bestSlots, postingHeatmap } from "@/lib/dashboard/platformReport";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";
import { recordDownload } from "@/lib/auth/activity";

const PERIODS = [7, 30, 90] as const;
const PLATFORMS = ["ALL", "YouTube", "Facebook", "Instagram", "TikTok"] as const;
const SHOWN = 30;
const thDate = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...o }).format(new Date(`${iso}T00:00:00Z`)) : "";
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const colorOf = (p: string) => PLATFORM_COLORS[p] || "#64748b";

/** Small line of the daily values. */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 110;
  const h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 3) - 1}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function RankChange({ x }: { x: TrendItem }) {
  if (x.prevRank === null) return <span className="trend-new">ใหม่</span>;
  const d = x.prevRank - x.rank;
  if (!d) return <span className="trend-same">–</span>;
  return <span className={d > 0 ? "trend-up" : "trend-down"}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>;
}

interface Props {
  /** Rows passing the filters except platform and date. */
  rows: RecordRow[];
  allRows: RecordRow[];
  latestDate: string;
}

export function TrendingHashtagsSection({ rows, allRows, latestDate }: Props) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("ALL");
  const [hideCommon, setHideCommon] = useState(true);
  const [sort, setSort] = useState<"views" | "posts" | "growth">("views");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [opened, setOpened] = useState<RecordRow | null>(null);

  const mine = useMemo(() => (platform === "ALL" ? rows : rows.filter((r) => r.platform === platform)), [rows, platform]);
  const { cur, prev } = useMemo(() => periodsEnding(latestDate || new Date().toISOString().slice(0, 10), period), [latestDate, period]);
  const trend = useMemo(() => trendingHashtags(mine, cur, prev, { hideCommon }), [mine, cur, prev, hideCommon]);
  const list = useMemo(() => {
    const items = [...trend.items];
    if (sort === "posts") items.sort((a, b) => b.posts - a.posts || a.rank - b.rank);
    if (sort === "growth") items.sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity) || a.rank - b.rank);
    return items;
  }, [trend, sort]);
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

  const controls = (
    <div className="trend-controls">
      <div className="segmented" aria-label="ช่วงเวลา">
        {PERIODS.map((p) => (
          <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
            {p} วัน
          </button>
        ))}
      </div>
      <div className="segmented" aria-label="แพลตฟอร์ม">
        {PLATFORMS.map((p) => (
          <button key={p} className={platform === p ? "active" : ""} onClick={() => setPlatform(p)}>
            {p === "ALL" ? "ทุกแพลตฟอร์ม" : p}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="panel trending-hashtags" id="trending-hashtags">
      {opened && <ClipDetailPanel clip={opened} allRows={allRows} latestDate={latestDate} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>
            <TrendingUp size={18} /> Trending Hashtag
          </h2>
          <p className="growth-sub">
            hashtag ในโพสต์ของเรา · {thDate(cur.start)} – {thDate(cur.end)} เทียบ {thDate(prev.start)} – {thDate(prev.end)} · ตามตัวกรองรายการด้านบน
          </p>
        </div>
      </div>
      {controls}

      {!selected && (
        <>
          <div className="trend-options">
            <label>
              <input type="checkbox" checked={hideCommon} onChange={(e) => setHideCommon(e.target.checked)} /> ซ่อน hashtag ประจำช่อง
              {hideCommon && trend.hidden.length > 0 && <small> ({trend.hidden.join(" ")})</small>}
            </label>
            <div className="segmented" aria-label="เรียงตาม">
              {(
                [
                  ["views", "วิว"],
                  ["posts", "จำนวนโพสต์"],
                  ["growth", "โตขึ้น"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} className={sort === k ? "active" : ""} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <p className="growth-notice">ยังไม่มี hashtag ที่ใช้อย่างน้อย 2 โพสต์ในช่วงนี้</p>
          ) : (
            <div className="table-scroll">
              <table className="trend-table">
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>Hashtag</th>
                    <th className="num">โพสต์ & วิว</th>
                    <th>แนวโน้ม</th>
                    <th>แพลตฟอร์ม</th>
                    <th className="num">เทียบช่วงก่อน</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? list : list.slice(0, SHOWN)).map((x) => (
                    <tr key={x.tag}>
                      <td className="trend-rank">
                        <b>{x.rank}</b>
                        <RankChange x={x} />
                      </td>
                      <td>
                        <button type="button" className="trend-tag" onClick={() => setSelected(x.tag)}>
                          {x.tag}
                        </button>
                        <small>{x.topicType}</small>
                      </td>
                      <td className="num">
                        <b>{compact(x.posts)}</b> <small>โพสต์</small>
                        <br />
                        <b>{compact(x.views)}</b> <small>วิว</small>
                      </td>
                      <td>
                        <Spark values={x.daily} />
                      </td>
                      <td>
                        <span className="trend-platforms" title={Object.entries(x.platforms).map(([p, v]) => `${p} ${num(v)}`).join(" · ")}>
                          {Object.entries(x.platforms)
                            .sort((a, b) => b[1] - a[1])
                            .map(([p, v]) => (
                              <i key={p} style={{ width: `${x.views ? (v / x.views) * 100 : 0}%`, background: colorOf(p) }} />
                            ))}
                        </span>
                      </td>
                      <td className={`num ${x.growth === null ? "" : x.growth >= 0 ? "up" : "down"}`}>{x.growth === null ? "-" : `${x.growth >= 0 ? "+" : ""}${pct(x.growth, 0)}`}</td>
                      <td>
                        <button type="button" className="trend-more" onClick={() => setSelected(x.tag)}>
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list.length > SHOWN && (
            <button type="button" className="ranking-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "แสดงน้อยลง" : `ดูทั้งหมด ${list.length} hashtag`}
            </button>
          )}
          <p className="audience-note">
            {num(trend.withTags)} จาก {num(trend.posts)} โพสต์ในช่วงนี้มี hashtag · วิว = ยอดสะสมล่าสุดของโพสต์ที่โพสต์ในช่วงนี้ · แนวโน้ม = วิวของโพสต์ตามวันที่โพสต์ · นับ hashtag ที่ใช้อย่างน้อย 2 โพสต์ · ซ่อน hashtag ของช่อง / รายการ / พิธีกร และที่อยู่ในโพสต์เกิน 60% · ไม่ใช่เทรนด์ของทั้ง TikTok (ดูได้จากปุ่มในหน้ารายละเอียด)
          </p>
        </>
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
              <button type="button" className="acc-export" onClick={downloadCsv}>
                <Download size={14} /> CSV
              </button>
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
