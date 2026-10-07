"use client";
// รายงาน → ผลการค้นหา: the posts the search box finds (with the other filters
// and the date range), per platform with likes, comments and shares, the top
// clips, month by month, and a CSV of every post found (lib/dashboard/search.ts).
import { useMemo, useState } from "react";
import { Download, ExternalLink, MessageCircle, Search, Trophy } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { searchByMonth, searchSummary, searchTerms } from "@/lib/dashboard/search";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";
import { recordDownload } from "@/lib/auth/activity";

const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const thMonth = (m: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${m}-01T00:00:00Z`));
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface Props {
  /** Rows passing every filter at the top, the search included. */
  rows: RecordRow[];
  allRows: RecordRow[];
  search: string;
  startDate: string;
  endDate: string;
  latestDate: string;
  /** Permission "download". */
  canDownload?: boolean;
}

export function SearchResultsSection({ rows, allRows, search, startDate, endDate, latestDate, canDownload = true }: Props) {
  const [opened, setOpened] = useState<RecordRow | null>(null);
  const terms = useMemo(() => searchTerms(search), [search]);
  const online = useMemo(() => rows.filter((r) => r.platform !== "TV"), [rows]);
  const sum = useMemo(() => searchSummary(rows), [rows]);
  const months = useMemo(() => searchByMonth(rows), [rows]);
  const topViews = useMemo(() => [...online].sort((a, b) => b.views - a.views).slice(0, 5), [online]);
  const topComments = useMemo(() => [...online].sort((a, b) => b.comments - a.comments).slice(0, 3), [online]);
  const withoutTags = online.filter((r) => r.platform !== "YouTube" && !r.hashtags).length;

  function downloadCsv() {
    const cols = ["Date", "Platform", "Channel", "Program", "VDO_Type", "Topic_Type", "Topic", "Hashtags", "Views", "Likes", "Comments", "Shares", "ER", "URL"];
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = online.map((r) =>
      [r.date, r.platform, r.channel, r.program, r.vdoType, r.topicType, r.topic, r.hashtags, r.views, r.likes, r.comments, r.shares, r.views ? ((r.likes + r.comments + r.shares) / r.views).toFixed(4) : "", r.url].map(cell).join(","),
    );
    const blob = new Blob(["﻿" + [cols.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `search-${terms.join("_").replace(/[^\p{L}\p{N}_]+/gu, "") || "all"}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    recordDownload("csv-search", a.download, online.length);
  }

  const Clip = ({ r, metric }: { r: RecordRow; metric: React.ReactNode }) => (
    <li>
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
        <b style={{ color: PLATFORM_COLORS[r.platform] || "#475569" }}>{r.platform}</b> · {thDate(r.date)} · {metric}
      </small>
    </li>
  );

  return (
    <section className="panel search-results" id="search-results">
      {opened && <ClipDetailPanel clip={opened} allRows={allRows} latestDate={latestDate} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>
            <Search size={18} /> ผลการค้นหา
          </h2>
          <p className="growth-sub">
            {terms.length ? (
              <>
                คำค้น: {terms.map((t) => <b key={t} className="search-term">{t}</b>)} {terms.length > 1 && "(เจอคำใดคำหนึ่งก็นับ)"} ·{" "}
              </>
            ) : null}
            {thDate(startDate)} – {thDate(endDate)} · ตามตัวกรองด้านบน
          </p>
        </div>
        {online.length > 0 && canDownload && (
          <button type="button" className="acc-export" onClick={downloadCsv}>
            <Download size={15} /> ดาวน์โหลด CSV ({num(online.length)} โพสต์)
          </button>
        )}
      </div>

      {!terms.length && (
        <p className="growth-notice">
          พิมพ์คำในช่องค้นหาด้านบนแล้วกด Enter เช่น <b>buddydean</b> หรือหลายคำคั่นด้วยจุลภาค <b>buddydean, บัดดี้ดีน</b> · ค้นจากชื่อคลิป รายการ ช่อง และ hashtag (รวมใน description / แคปชัน) · มี # หรือไม่มีก็ได้
        </p>
      )}

      {terms.length > 0 && !rows.length && <p className="growth-notice">ไม่พบโพสต์ที่ตรงกับคำค้นในช่วงและตัวกรองนี้</p>}

      {rows.length > 0 && (
        <>
          <article className="growth-table">
            <h3>สรุปแยกแพลตฟอร์ม</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>แพลตฟอร์ม</th>
                    <th className="num">โพสต์</th>
                    <th className="num">วิว</th>
                    <th className="num">Like</th>
                    <th className="num">Comment</th>
                    <th className="num">Share</th>
                    <th className="num">ER</th>
                    <th className="num">สัดส่วนวิว</th>
                  </tr>
                </thead>
                <tbody>
                  {sum.lines.map((l) => (
                    <tr key={l.platform}>
                      <td>
                        <b style={{ color: PLATFORM_COLORS[l.platform] || "#475569" }}>{l.platform}</b>
                      </td>
                      <td className="num">{num(l.posts)}</td>
                      <td className="num strong">{num(l.views)}</td>
                      <td className="num">{num(l.likes)}</td>
                      <td className="num">{num(l.comments)}</td>
                      <td className="num">{num(l.shares)}</td>
                      <td className="num">{pct(l.er)}</td>
                      <td className="num">{sum.total.views ? `${Math.round((l.views / sum.total.views) * 100)}%` : "-"}</td>
                    </tr>
                  ))}
                  <tr className="acc-total">
                    <td>รวม</td>
                    <td className="num">{num(sum.total.posts)}</td>
                    <td className="num">{num(sum.total.views)}</td>
                    <td className="num">{num(sum.total.likes)}</td>
                    <td className="num">{num(sum.total.comments)}</td>
                    <td className="num">{num(sum.total.shares)}</td>
                    <td className="num">{pct(sum.total.er)}</td>
                    <td className="num">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {sum.tv.episodes > 0 && <p className="audience-note">TV: {num(sum.tv.episodes)} เทป · ผู้ชมรวม {compact(sum.tv.audience)} (ไม่รวมในตารางออนไลน์)</p>}
            <p className="audience-note">
              ER = (Like + Comment + Share) ÷ วิว · Share ของ Facebook เป็น 0 เพราะ API ไม่ให้ยอดแชร์ของโพสต์วิดีโอ
              {withoutTags > 0 && ` · FB/IG/TikTok ${num(withoutTags)} โพสต์ยังไม่มี hashtag ในระบบ (ค้นเจอจากชื่อคลิปเท่านั้น) ตัวเลขแพลตฟอร์มเหล่านี้อาจยังไม่ครบ`}
            </p>
          </article>

          <div className="platform-report-grid search-results-grid">
            <article className="growth-table">
              <h3>
                <Trophy size={15} /> วิวสูงสุด 5 อันดับ
              </h3>
              <ol className="search-clips">
                {topViews.map((r, i) => (
                  <Clip key={`v-${i}`} r={r} metric={`${compact(r.views)} วิว · ${num(r.likes)} Like · ${num(r.comments)} Comment`} />
                ))}
              </ol>
            </article>
            <article className="growth-table">
              <h3>
                <MessageCircle size={15} /> คอมเมนต์สูงสุด 3 อันดับ
              </h3>
              <ol className="search-clips">
                {topComments.map((r, i) => (
                  <Clip key={`c-${i}`} r={r} metric={`${num(r.comments)} Comment · ${compact(r.views)} วิว`} />
                ))}
              </ol>
            </article>
          </div>

          {months.length > 1 && (
            <article className="growth-table">
              <h3>รายเดือน</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>เดือน</th>
                      <th className="num">โพสต์</th>
                      <th className="num">วิว</th>
                      <th className="num">Like</th>
                      <th className="num">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.month}>
                        <td>{thMonth(m.month)}</td>
                        <td className="num">{num(m.posts)}</td>
                        <td className="num strong">{num(m.views)}</td>
                        <td className="num">{num(m.likes)}</td>
                        <td className="num">{num(m.comments)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="audience-note">นับตามเดือนที่โพสต์ · วิว / Like / Comment เป็นยอดสะสมล่าสุดของโพสต์เหล่านั้น</p>
            </article>
          )}
        </>
      )}
    </section>
  );
}
