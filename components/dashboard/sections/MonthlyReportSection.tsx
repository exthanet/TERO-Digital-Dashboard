"use client";
// รายงานประจำเดือน: the meeting deck inside the dashboard. Numbers are frozen
// per month in monthlyReports/{YYYY-MM} (lib/monthlyReportData.ts) and only
// people with the monthlyReport permission read them (firestore.rules).
// Admins make / replace a month's report and take the PDF; every page of the
// PDF carries the downloader's name, and each download is logged (downloads).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Maximize, RefreshCw, X } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import {
  buildMonthlyReport,
  compactNumber,
  lastFullMonth,
  monthLabel,
  monthPeriod,
  type ChannelTv,
  type CompetitorBlock,
  type YoutubeGroup,
  type MonthlyReport,
} from "@/lib/dashboard/monthlyReport";
import { listMonthlyReports, saveMonthlyReport, type SavedReport } from "@/lib/monthlyReportData";
import { loadYtAnalytics } from "@/lib/ytAnalyticsData";
import { firstGrowthDay, loadGrowthDays } from "@/lib/growthData";
import { daysBetween } from "@/lib/dashboard/growth";
import { TRAFFIC_LABEL } from "@/lib/dashboard/ytDeepDive";
import { loadTvCompetitors } from "@/lib/tvCompetitorData";
import { recordDownload } from "@/lib/auth/activity";
import { track } from "@/lib/loadingBar";
import "@/styles/monthly-report.css";

interface Props {
  rows: RecordRow[];
  latestDate: string;
  isAdmin: boolean;
  userName: string;
}

const PLATFORM_COLORS: Record<string, string> = { YouTube: "#ef4444", Facebook: "#3b82f6", Instagram: "#d946ef", TikTok: "#111827" };
/** "14 ก.ย." / "14 ก.ย. 2026" (Gregorian year, as the rest of the report). */
const dateLabel = (d: string, year = false) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH-u-ca-gregory", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }) : "-";
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const rating = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toFixed(3));

/** 66 → "66 วินาที", 920 → "15 นาที 20 วินาที". */
const duration = (sec: number) => (sec < 120 ? `${sec} วินาที` : `${Math.floor(sec / 60)} นาที ${sec % 60} วินาที`);

function YoutubeCard({ title, g }: { title: string; g: YoutubeGroup }) {
  return (
    <div className="mr-card">
      <h3>{title}</h3>
      <b className="mr-big">{g.videos.toLocaleString("en-US")} คลิป</b>
      <p>
        {compactNumber(g.views)} วิว · ดูเฉลี่ย <b>{duration(g.avgViewSec)}</b>
      </p>
      <p>
        ดู <b className={g.avgViewPct >= 100 ? "mr-up" : g.avgViewPct < 35 ? "mr-down" : ""}>{g.avgViewPct}%</b> ของความยาวคลิป{g.avgViewPct >= 100 ? " (มีคนดูซ้ำ)" : ""}
      </p>
      <p>
        ผู้ติดตามใหม่ <b>{g.subs.toLocaleString("en-US")}</b>
      </p>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="mr-muted">–</span>;
  if (value > 3) return <span className="mr-up">▲ &gt;300%</span>;
  return <span className={value >= 0 ? "mr-up" : "mr-down"}>{value >= 0 ? "▲" : "▼"} {Math.abs(value * 100).toFixed(0)}%</span>;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="mr-bar">
      <span style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

function Slide({ report, n, total, title, children, watermark }: { report: MonthlyReport; n: number; total: number; title?: string; children: React.ReactNode; watermark: string }) {
  return (
    <section className="mr-slide">
      <header className="mr-slide-head">
        <span>TERO Digital · รายงานประจำเดือน {monthLabel(report.month)}</span>
        <span>
          เอกสารภายใน · {n}/{total}
        </span>
      </header>
      {title && <h2>{title}</h2>}
      <div className="mr-slide-body">{children}</div>
      {watermark && (
        <div className="mr-watermark" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>{watermark}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function CompetitorTable({ block, rows: limit }: { block: CompetitorBlock; rows: number }) {
  // The best `limit`, with ถกไม่เถียง always in the table.
  const top = block.ranking.slice(0, limit);
  const own = block.ranking.find((r) => r.own);
  const list = own && !top.includes(own) ? [...top.slice(0, limit - 1), own] : top;
  return (
    <div>
      <h3>{block.mode === "slot" ? "รายการข่าว / ทอล์กที่ใช้เทียบ" : "ช่องคู่แข่งช่วงเวลาเดียวกัน"}</h3>
      <table className="mr-table">
        <thead>
          <tr>
            <th>{block.mode === "slot" ? "รายการ" : "ช่อง"}</th>
            <th className="n">เฉลี่ย</th>
            <th className="n">วัน</th>
            <th className="n">เราชนะ</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.key} className={r.own ? "mr-own" : ""}>
              <td>{r.own ? `${r.key} (เรา)` : r.key}</td>
              <td className="n">
                <b>{r.avg.toFixed(3)}</b>
              </td>
              <td className="n">{r.days}</td>
              <td className="n">{r.winShare === null ? "" : pct(r.winShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TvSlide({ ch, blocks }: { ch: ChannelTv; blocks: CompetitorBlock[] }) {
  return (
    <div className="mr-grid2">
      <div>
        <p className="mr-lead">
          เฉลี่ย <b>{rating(ch.avg)}</b> · เดือนก่อน {rating(ch.prevAvg)} · {ch.episodes} เทป · ผู้ชมรวม {compactNumber(ch.audience)}
        </p>
        <h3>Top 5 เทป · Rating {ch.channel}</h3>
        <table className="mr-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th className="n">Rating</th>
              <th>ประเด็น</th>
            </tr>
          </thead>
          <tbody>
            {ch.top.map((e) => (
              <tr key={e.date}>
                <td className="nowrap">{dateLabel(e.date)}</td>
                <td className="n">
                  <b>{e.rating.toFixed(3)}</b>
                </td>
                <td>{e.topic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mr-stack mr-compact">
        {blocks.length ? blocks.map((b) => <CompetitorTable key={b.mode} block={b} rows={blocks.length > 1 ? 6 : 10} />) : <p className="mr-muted">ยังไม่มีข้อมูลคู่แข่งของช่องนี้ในเดือนนี้</p>}
      </div>
    </div>
  );
}

/** Every page of one report, in order. */
function slidesOf(r: MonthlyReport): { title?: string; cover?: boolean; body: React.ReactNode }[] {
  const period = monthPeriod(r.month);
  const prevName = monthLabel(r.prevMonth);
  const maxPlat = Math.max(1, ...r.platforms.map((p) => p.views));
  const maxProg = Math.max(1, ...r.programs.map((p) => p.views));
  const maxTopic = Math.max(1, ...r.topics.map((t) => t.medianViews));
  const top = r.platforms[0];
  const second = r.platforms[1];
  const topProgram = r.programs[0];
  const viewsChange = r.onlinePrev.views > 0 ? (r.online.views - r.onlinePrev.views) / r.onlinePrev.views : null;
  const pages: { title?: string; cover?: boolean; body: React.ReactNode }[] = [];

  pages.push({
    cover: true,
    body: (
      <div className="mr-cover">
        <p>TERO Digital</p>
        <h1>
          รายงานประจำเดือน
          <br />
          {monthLabel(r.month)}
        </h1>
        <p>
          โพสต์ที่ลงวันที่ {dateLabel(period.start)} – {dateLabel(period.end, true)} เทียบกับ{prevName}
        </p>
        <small>ข้อมูลจาก Metricool / YouTube API / Nielsen · ตัวเลข ณ วันที่ {dateLabel(r.dataAt, true)} · เอกสารภายใน ห้ามเผยแพร่</small>
      </div>
    ),
  });

  pages.push({
    title: "สรุปในหน้าเดียว",
    body: (
      <>
        <div className="mr-kpis">
          <div>
            <small>วิวรวม (ออนไลน์)</small>
            <b>{compactNumber(r.online.views)}</b>
            <Change value={viewsChange} />
          </div>
          <div>
            <small>จำนวนโพสต์</small>
            <b>{r.online.posts.toLocaleString("en-US")}</b>
            <Change value={r.onlinePrev.posts ? (r.online.posts - r.onlinePrev.posts) / r.onlinePrev.posts : null} />
          </div>
          <div>
            <small>วิวต่อโพสต์ (ค่ากลาง)</small>
            <b>{compactNumber(r.online.medianViews ?? 0)}</b>
            <Change value={r.onlinePrev.medianViews ? ((r.online.medianViews ?? 0) - r.onlinePrev.medianViews) / r.onlinePrev.medianViews : null} />
          </div>
          <div>
            <small>Engagement Rate</small>
            <b>{pct(r.online.er, 1)}</b>
            <span className="mr-muted">เดือนก่อน {pct(r.onlinePrev.er, 1)}</span>
          </div>
        </div>
        {r.tvChannels.length > 0 && (
          <div className="mr-kpis">
            {r.tvChannels.map((c) => (
              <div key={c.channel}>
                <small>TV Rating เฉลี่ย {c.channel}</small>
                <b>{rating(c.avg)}</b>
                <span className="mr-muted">
                  เดือนก่อน {rating(c.prevAvg)} · {c.episodes} เทป
                </span>
              </div>
            ))}
            <div>
              <small>ผู้ชมทีวีรวม</small>
              <b>{compactNumber(r.tvChannels.reduce((a, c) => a + c.audience, 0))}</b>
              <span className="mr-muted">One31 + GMM25</span>
            </div>
          </div>
        )}
        <ul className="mr-say">
          <li>
            วิวรวมของโพสต์ที่ลงเดือนนี้ {compactNumber(r.online.views)} {viewsChange === null ? "" : `${viewsChange >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${pct(Math.abs(viewsChange))} จาก${prevName}`}
          </li>
          {top && second && (
            <li>
              {top.platform} เป็นแพลตฟอร์มหลัก สัดส่วนวิว {pct(top.share)} ตามด้วย {second.platform} {pct(second.share)}
            </li>
          )}
          {topProgram && (
            <li>
              รายการที่มีวิวมากที่สุดคือ “{topProgram.program}” {compactNumber(topProgram.views)} วิว ({pct(topProgram.share)} ของทั้งหมด)
            </li>
          )}
        </ul>
        <p className="mr-note">วิว = วิวสะสมของโพสต์ที่ลงในเดือนนั้น ณ วันที่ทำรายงาน · โพสต์เดือนก่อนมีเวลาสะสมวิวนานกว่า การเทียบจึงเอียงไปทางเดือนก่อนเล็กน้อย</p>
      </>
    ),
  });

  pages.push({
    title: "แต่ละแพลตฟอร์ม",
    body: (
      <>
        <table className="mr-table">
          <thead>
            <tr>
              <th>แพลตฟอร์ม</th>
              <th>วิวรวม</th>
              <th className="n" />
              <th className="n">สัดส่วน</th>
              <th className="n">เทียบเดือนก่อน</th>
              <th className="n">โพสต์</th>
              <th className="n">วิว/โพสต์</th>
              <th className="n">ER</th>
            </tr>
          </thead>
          <tbody>
            {r.platforms.map((p) => (
              <tr key={p.platform}>
                <td>
                  <i className="mr-dot" style={{ background: PLATFORM_COLORS[p.platform] || "#94a3b8" }} />
                  {p.platform}
                </td>
                <td className="mr-barcell">
                  <Bar value={p.views} max={maxPlat} color={PLATFORM_COLORS[p.platform] || "#94a3b8"} />
                </td>
                <td className="n">
                  <b>{compactNumber(p.views)}</b>
                </td>
                <td className="n">{pct(p.share)}</td>
                <td className="n">
                  <Change value={p.growth} />
                </td>
                <td className="n">{p.posts.toLocaleString("en-US")}</td>
                <td className="n">{compactNumber(p.medianViews)}</td>
                <td className="n">{pct(p.er, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>รูปแบบวิดีโอ</h3>
        <table className="mr-table">
          <thead>
            <tr>
              <th>รูปแบบ</th>
              <th className="n">สัดส่วนโพสต์</th>
              <th className="n">สัดส่วนวิว</th>
              <th className="n">วิว/โพสต์</th>
            </tr>
          </thead>
          <tbody>
            {r.formats.map((f) => (
              <tr key={f.vdoType}>
                <td>{f.vdoType}</td>
                <td className="n">{pct(f.postShare)}</td>
                <td className="n">{pct(f.viewShare)}</td>
                <td className="n">{compactNumber(f.medianViews)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mr-note">วิว/โพสต์ = ค่ากลาง (median) ไม่ให้คลิปแมสคลิปเดียวดึงตัวเลข · ER = (ไลก์ + คอมเมนต์ + แชร์) ÷ วิว</p>
      </>
    ),
  });

  pages.push({
    title: "แต่ละรายการ (10 อันดับแรก)",
    body: (
      <>
        <table className="mr-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>วิวรวม</th>
              <th className="n" />
              <th className="n">สัดส่วน</th>
              <th className="n">เทียบเดือนก่อน</th>
              <th className="n">โพสต์</th>
              <th className="n">วิว/โพสต์</th>
              <th className="n">ทีวี</th>
            </tr>
          </thead>
          <tbody>
            {r.programs.map((p) => (
              <tr key={p.program}>
                <td>{p.program}</td>
                <td className="mr-barcell">
                  <Bar value={p.views} max={maxProg} color="#4f7db8" />
                </td>
                <td className="n">
                  <b>{compactNumber(p.views)}</b>
                </td>
                <td className="n">{pct(p.share, 1)}</td>
                <td className="n">
                  <Change value={p.growth} />
                </td>
                <td className="n">{p.posts.toLocaleString("en-US")}</td>
                <td className="n">{compactNumber(p.medianViews)}</td>
                <td className="n">{p.tvEpisodes ? `${p.tvEpisodes} เทป · ${rating(p.tvRating)}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mr-note">ทีวี = จำนวนเทปและ Rating เฉลี่ย One31 · รายการที่มีโพสต์ไม่ถึง 5 ชิ้นรวมอยู่ใน “อื่นๆ”</p>
      </>
    ),
  });

  for (const ch of r.tvChannels) {
    pages.push({ title: `TV Rating · ${ch.channel}`, body: <TvSlide ch={ch} blocks={r.competitors.filter((b) => b.channel === ch.channel)} /> });
  }

  pages.push({
    title: "คลิปเด่นและประเด็นที่ได้ผล",
    body: (
      <div className="mr-grid2">
        <div>
          <h3>Top 5 คลิป</h3>
          <table className="mr-table">
            <tbody>
              {r.topClips.map((c, i) => (
                <tr key={`${c.platform}${c.url}${i}`}>
                  <td>
                    <b>{i + 1}</b>
                  </td>
                  <td>
                    {c.topic}
                    <br />
                    <small className="mr-muted">
                      {c.platform} · {c.program} · {dateLabel(c.date)}
                    </small>
                  </td>
                  <td className="n">
                    <b>{compactNumber(c.views)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Topic Type ที่ได้ผลดี</h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>ประเด็น</th>
                <th>วิว/โพสต์</th>
                <th className="n" />
                <th className="n">โพสต์</th>
              </tr>
            </thead>
            <tbody>
              {r.topics.map((t) => (
                <tr key={t.topicType}>
                  <td>{t.topicType}</td>
                  <td className="mr-barcell">
                    <Bar value={t.medianViews} max={maxTopic} color={t.index >= 1 ? "#459d71" : "#e0a03a"} />
                  </td>
                  <td className="n">
                    {compactNumber(t.medianViews)} <small className="mr-muted">({t.index.toFixed(1)}×)</small>
                  </td>
                  <td className="n">{t.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mr-note">× = เทียบกับค่ากลางทั้งเดือน {compactNumber(r.overallMedian)} วิวต่อโพสต์ · นับประเด็นที่มีอย่างน้อย 10 โพสต์</p>
        </div>
      </div>
    ),
  });

  pages.push({
    title: "Hashtag และเวลาโพสต์",
    body: (
      <div className="mr-grid2">
        <div>
          <h3>Hashtag ที่มีวิวสูงสุด</h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>แท็ก</th>
                <th className="n">โพสต์</th>
                <th className="n">วิว</th>
              </tr>
            </thead>
            <tbody>
              {r.hashtags.map((t) => (
                <tr key={t.tag}>
                  <td>
                    <span className="mr-tag">{t.tag}</span>
                  </td>
                  <td className="n">{t.posts}</td>
                  <td className="n">{compactNumber(t.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mr-note">โพสต์ที่มี Hashtag {pct(r.taggedShare)} ของทั้งหมด · ไม่นับแท็กของช่อง / รายการ</p>
        </div>
        <div>
          <h3>ช่วงเวลาที่ได้ผลดีที่สุด</h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>วัน · เวลา</th>
                <th className="n">วิว/โพสต์</th>
                <th className="n">โพสต์</th>
              </tr>
            </thead>
            <tbody>
              {r.slots.map((s) => (
                <tr key={`${s.day}${s.hour}`}>
                  <td>
                    <b>
                      {s.day} {String(s.hour).padStart(2, "0")}:00–{String(s.hour + 1).padStart(2, "0")}:00
                    </b>
                  </td>
                  <td className="n">{compactNumber(s.medianViews)}</td>
                  <td className="n">{s.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mr-note">ค่ากลางทั้งเดือน {compactNumber(r.overallMedian)} วิวต่อโพสต์ · นับช่วงที่มีอย่างน้อย 10 โพสต์ · เป็นความสัมพันธ์ ควรทดลองยืนยัน</p>
        </div>
      </div>
    ),
  });

  const deep = r.deep;
  if (deep?.youtube) {
    const y = deep.youtube;
    pages.push({
      title: "เชิงลึก A · คุณภาพการดู YouTube",
      body: (
        <>
          <p className="mr-lead">
            คนดูคลิปยาวเฉลี่ยแค่ {y.long.avgViewPct}% ของความยาว · Shorts ดูครบ {y.shorts.avgViewPct}%{y.shorts.avgViewPct >= 100 ? " (มีคนดูซ้ำ)" : ""}
          </p>
          <div className="mr-grid2 auto">
            <YoutubeCard title="Shorts" g={y.shorts} />
            <YoutubeCard title="คลิปยาว" g={y.long} />
          </div>
          <p className="mr-lead">
            ผู้ติดตามใหม่จากคลิปที่ลงเดือนนี้ <b>{y.newSubs.toLocaleString("en-US")}</b> คน
          </p>
          <p className="mr-note">
            คิดจาก {y.matched.toLocaleString("en-US")} จาก {y.posts.toLocaleString("en-US")} คลิป YouTube ที่มีตัวเลขใน YouTube Analytics (ยอดตลอดอายุคลิป ณ {dateLabel(y.updatedAt.slice(0, 10), true)}) · คลิปยาว 100% = ดูจนจบ
          </p>
        </>
      ),
    });
    if (y.traffic.length) {
      const maxTraffic = Math.max(...y.traffic.map((t) => t.share));
      const search = y.traffic.find((t) => t.source === "YT_SEARCH");
      pages.push({
        title: "เชิงลึก B · คนเจอคลิป YouTube จากไหน",
        body: (
          <>
            <table className="mr-table">
              <tbody>
                {y.traffic.map((t) => (
                  <tr key={t.source}>
                    <td>{TRAFFIC_LABEL[t.source] || t.source}</td>
                    <td className="mr-barcell">
                      <Bar value={t.share} max={maxTraffic} color={t.source === "YT_SEARCH" ? "#c0504d" : "#4f7db8"} />
                    </td>
                    <td className="n">
                      <b className={t.source === "YT_SEARCH" ? "mr-down" : ""}>{pct(t.share, 1)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mr-lead">{search ? `คนค้นหาเจอคลิปใน YouTube เพียง ${pct(search.share, 1)} · ส่วนใหญ่มาจากผู้ติดตามและหน้า Shorts` : "ส่วนใหญ่มาจากผู้ติดตามและหน้า Shorts"}</p>
            <p className="mr-note">คิดจาก {y.trafficVideos} คลิปที่ YouTube รายงานแหล่งที่มา (คลิปวิวสูงสุดของเดือน) · ยอดตลอดอายุคลิป</p>
          </>
        ),
      });
    }
  }
  if (deep) {
    const maxDay = Math.max(1, ...deep.weekdays.map((w) => w.avgPerDay));
    pages.push({
      title: "เชิงลึก C · Engagement และวันโพสต์",
      body: (
        <div className="mr-grid2">
          <div>
            <h3>ต่อ 1,000 วิว</h3>
            <table className="mr-table">
              <thead>
                <tr>
                  <th>แพลตฟอร์ม</th>
                  <th className="n">แชร์</th>
                  <th className="n">คอมเมนต์</th>
                  <th className="n">ดูเฉลี่ย</th>
                  <th className="n">กดข้าม</th>
                </tr>
              </thead>
              <tbody>
                {deep.engagement.map((e) => (
                  <tr key={e.platform}>
                    <td>{e.platform}</td>
                    <td className="n">
                      <b>{e.sharesPer1k.toFixed(1)}</b>
                    </td>
                    <td className="n">
                      <b>{e.commentsPer1k.toFixed(1)}</b>
                    </td>
                    <td className="n">{e.avgWatchSec === null ? "–" : `${e.avgWatchSec} วิ`}</td>
                    <td className="n">{e.skipRate === null ? "–" : <b className={e.skipRate >= 40 ? "mr-down" : ""}>{e.skipRate}%</b>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mr-note">– = แพลตฟอร์มไม่ส่งข้อมูลนี้ · กดข้าม = % ที่ปัดทิ้งตั้งแต่ต้นคลิป (Instagram Reels)</p>
          </div>
          <div>
            <h3>วิวเฉลี่ยต่อวัน ตามวันที่โพสต์</h3>
            <table className="mr-table">
              <tbody>
                {deep.weekdays.map((w) => (
                  <tr key={w.day}>
                    <td>{w.day}</td>
                    <td className="mr-barcell wide">
                      <Bar value={w.avgPerDay} max={maxDay} color="#4f7db8" />
                    </td>
                    <td className="n">
                      <b>{compactNumber(w.avgPerDay)}</b>
                    </td>
                    <td className="n mr-muted">{w.posts} โพสต์</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mr-note">วิวของโพสต์ที่ลงวันนั้น ÷ จำนวนวันนั้นในเดือน (วันที่ไม่มีโพสต์นับเป็น 0)</p>
          </div>
        </div>
      ),
    });
    if (deep.growth) {
      const gr = deep.growth;
      pages.push({
        title: "เชิงลึก D · วิวที่เพิ่มขึ้นรายวัน",
        body: (
          <>
            <div className="mr-kpis">
              <div>
                <small>วิวที่เพิ่มในเดือนนี้</small>
                <b>{compactNumber(gr.totalViews)}</b>
              </div>
              <div>
                <small>เฉลี่ยต่อวัน</small>
                <b>{compactNumber(gr.perDay)}</b>
              </div>
              <div>
                <small>จำนวนวันที่มีข้อมูล</small>
                <b>
                  {gr.days}/{gr.of}
                </b>
              </div>
            </div>
            <h3>วันที่วิวเพิ่มมากที่สุด</h3>
            <table className="mr-table">
              <tbody>
                {gr.peaks.map((p) => (
                  <tr key={p.day}>
                    <td>{dateLabel(p.day, true)}</td>
                    <td className="n">
                      <b>{compactNumber(p.views)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mr-note">วิวที่เกิดขึ้นจริงในแต่ละวันของทุกคลิป รวมคลิปเก่า (ต่างจากหน้าอื่นที่นับยอดสะสมของคลิปที่ลงในเดือน) · เริ่มเก็บ 1 ต.ค. 2026</p>
          </>
        ),
      });
    }
    if (deep.shorts.features.length) {
      pages.push({
        title: "รูปแบบคลิปสั้นที่ได้ผล",
        body: (
          <>
            <table className="mr-table">
              <thead>
                <tr>
                  <th>ปัจจัย</th>
                  <th>แบบที่ได้ผลดีสุด</th>
                  <th className="n">ดัชนี</th>
                  <th>แบบที่ได้ผลน้อยสุด</th>
                  <th className="n">ดัชนี</th>
                </tr>
              </thead>
              <tbody>
                {deep.shorts.features.map((ft) => {
                  const top = ft.groups[0];
                  const low = ft.groups[ft.groups.length - 1];
                  return (
                    <tr key={ft.name}>
                      <td>{ft.name}</td>
                      <td>
                        <b>{top.value}</b> <small className="mr-muted">({top.posts})</small>
                      </td>
                      <td className="n">
                        <b className={top.index >= 1 ? "mr-up" : ""}>{top.index.toFixed(2)}×</b>
                      </td>
                      <td>
                        {low.value} <small className="mr-muted">({low.posts})</small>
                      </td>
                      <td className="n">
                        <b className={low.index < 1 ? "mr-down" : ""}>{low.index.toFixed(2)}×</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mr-note">
              คลิปสั้น {deep.shorts.posts.toLocaleString("en-US")} คลิป (TikTok, Shorts, Reels) · ดัชนี = ค่ากลางวิวของกลุ่ม ÷ ค่ากลางคลิปสั้นแพลตฟอร์มเดียวกัน (1× = ปกติ) · ตัวเลขในวงเล็บ = จำนวนคลิป นับกลุ่มที่มีอย่างน้อย 20 คลิป · เป็นความสัมพันธ์ ไม่ใช่เหตุผลที่แน่ชัด
            </p>
          </>
        ),
      });
    }
    if (deep.seo) {
      const sc = deep.seo;
      pages.push({
        title: "SEO YouTube",
        body: (
          <div className="mr-grid2">
            <div>
              <div className="mr-kpis two">
                <div>
                  <small>วิวจากการค้นหาใน YouTube</small>
                  <b>{sc.searchShare === null ? "–" : pct(sc.searchShare, 1)}</b>
                </div>
                <div>
                  <small>คำค้นที่เป็นชื่อรายการ/ช่อง</small>
                  <b>{sc.brandShare === null ? "–" : pct(sc.brandShare)}</b>
                </div>
                <div>
                  <small>ชื่อคลิปยาวเกิน 70 ตัวอักษร</small>
                  <b className={sc.posts && sc.titleOver70 / sc.posts > 0.5 ? "mr-down" : ""}>{sc.posts ? pct(sc.titleOver70 / sc.posts) : "–"}</b>
                </div>
                <div>
                  <small>คลิปที่ไม่มี Hashtag</small>
                  <b>{sc.posts ? pct(sc.noHashtag / sc.posts) : "–"}</b>
                </div>
              </div>
            </div>
            <div>
              <h3>คำที่คนค้นแต่ยังไม่มีคลิปชื่อตรง</h3>
              <table className="mr-table">
                <tbody>
                  {sc.gaps.length ? (
                    sc.gaps.map((g) => (
                      <tr key={g.term}>
                        <td>{g.term}</td>
                        <td className="n">
                          <b>{compactNumber(g.views)}</b>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="mr-muted">ไม่มี</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <h3>คำค้นอื่นที่พาคนมา (ไม่นับชื่อรายการ)</h3>
              <table className="mr-table">
                <tbody>
                  {sc.terms.slice(0, 5).map((g) => (
                    <tr key={g.term}>
                      <td>{g.term}</td>
                      <td className="n">
                        <b>{compactNumber(g.views)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mr-note">ข้อมูลคำค้นเป็นของช่องใน 28 วันล่าสุด ({sc.range}) ไม่ใช่เฉพาะเดือนนี้ · ชื่อคลิปและ Hashtag นับจากคลิป YouTube ที่ลงในเดือนนี้</p>
          </div>
        ),
      });
    }
  }

  const RECS_PER_PAGE = 5;
  const pagesOfRecs = Math.max(1, Math.ceil(r.recommendations.length / RECS_PER_PAGE));
  for (let p = 0; p < pagesOfRecs; p++) {
    pages.push({
      title: pagesOfRecs > 1 ? `คำแนะนำจากตัวเลขเดือนนี้ (${p + 1}/${pagesOfRecs})` : "คำแนะนำจากตัวเลขเดือนนี้",
      body: (
        <>
          <ol className="mr-recs" start={p * RECS_PER_PAGE + 1}>
            {r.recommendations.slice(p * RECS_PER_PAGE, (p + 1) * RECS_PER_PAGE).map((x) => (
              <li key={x.title}>
                <h3>{x.title}</h3>
                <p>{x.because}</p>
                <p className="mr-act">→ {x.action}</p>
              </li>
            ))}
          </ol>
          <p className="mr-note">คำแนะนำสร้างจากกฎที่ตั้งไว้กับตัวเลขในรายงาน (ไม่ใช้ AI) · ควรดูร่วมกับบริบทของทีม</p>
        </>
      ),
    });
  }

  pages.push({
    title: "เขียนให้คนและ AI หาเจอ: SEO · AEO · GEO",
    body: (
      <>
        <div className="mr-cols3">
          <div className="mr-card">
            <h3>SEO</h3>
            <small className="mr-muted">ติดอันดับ Google / YouTube</small>
            <ul>
              <li>คีย์เวิร์ดที่คนค้นจริงไว้ต้นหัวข้อ</li>
              <li>หัวข้อไม่เกิน 60–70 ตัวอักษร</li>
              <li>คำอธิบายหน้า 120–155 ตัวอักษร</li>
              <li>URL สั้น อ่านรู้เรื่อง</li>
              <li>ลิงก์ไปบทความที่เกี่ยวข้อง</li>
            </ul>
          </div>
          <div className="mr-card">
            <h3>AEO</h3>
            <small className="mr-muted">ถูกดึงไปเป็น “คำตอบ”</small>
            <ul>
              <li>ย่อหน้าแรกตอบจบใน 40–60 คำ</li>
              <li>หัวข้อย่อยเป็นคำถามที่คนค้น</li>
              <li>มี FAQ ถาม-ตอบ</li>
              <li>เหมาะกับกล่องคำตอบของ Google และผู้ช่วยเสียง</li>
            </ul>
          </div>
          <div className="mr-card">
            <h3>GEO</h3>
            <small className="mr-muted">ให้ AI อ้างอิงเรา</small>
            <ul>
              <li>ชื่อคน หน่วยงาน วันที่ ตัวเลข ให้ชัด</li>
              <li>คำพูดพร้อมชื่อผู้พูด</li>
              <li>ใส่แหล่งที่มา</li>
              <li>ระบุผู้เขียนและวันที่อัปเดต</li>
            </ul>
          </div>
        </div>
        <p className="mr-note">เป้าหมาย: ให้ Google, YouTube, ChatGPT, Gemini และ AI Overviews หาเจอและอ้างอิงเนื้อหาของเรา · คำค้นที่คนหาจริงของเดือนนี้ดูได้ในหน้า SEO YouTube</p>
      </>
    ),
  });

  pages.push({
    title: "Template บทความจาก 1 ตอนของรายการ",
    body: (
      <>
        <ol className="mr-template">
          <li><b>หัวข้อไม่เกิน 65 ตัวอักษร</b> [SEO] — [ชื่อคน/เรื่อง] + [ประเด็น] | ถกไม่เถียง [วันที่]</li>
          <li><b>คำอธิบายหน้า 120–155 ตัวอักษร</b> [SEO]</li>
          <li><b>สรุปสั้น 40–60 คำ</b> [AEO] — ใคร ทำอะไร ที่ไหน เมื่อไหร่</li>
          <li><b>ข้อเท็จจริงสำคัญ 3–5 ข้อ</b> [GEO]</li>
          <li><b>คำพูดสำคัญ</b> [GEO] — พร้อมชื่อและตำแหน่งผู้พูด</li>
          <li><b>ไทม์ไลน์เหตุการณ์</b> (ถ้ามี)</li>
          <li><b>ฝังคลิป YouTube</b> + ลิงก์คลิปสั้น</li>
          <li><b>FAQ 3 ข้อ</b> [AEO] — หัวข้อเป็นคำถามที่คนค้น</li>
          <li><b>แหล่งที่มา ผู้เขียน และวันที่อัปเดต</b> [GEO]</li>
          <li><b>Schema</b> (ฝ่ายเว็บใส่) — NewsArticle + VideoObject + FAQPage</li>
        </ol>
        <p className="mr-note">รายละเอียดข่าวให้ทีมข่าวเติมจากข้อเท็จจริงในรายการ · ตัวอย่างหัวข้อ: [ชื่อคน/เรื่อง] + [ประเด็น] | ถกไม่เถียง 3 ก.ย. 69</p>
      </>
    ),
  });
  return pages;
}

export function MonthlyReportSection({ rows, latestDate, isAdmin, userName }: Props) {
  const [saved, setSaved] = useState<SavedReport[] | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const [draft, setDraft] = useState<MonthlyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [present, setPresent] = useState<number | null>(null);
  const [watermark, setWatermark] = useState("");
  const presentRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    track(listMonthlyReports())
      .then((list) => {
        setSaved(list);
        setMonth((m) => m || list[0]?.month || "");
      })
      .catch((e) => setError(String(e?.message || e)));
  }, []);
  useEffect(reload, [reload]);

  const suggested = latestDate ? lastFullMonth(latestDate) : "";
  const current = saved?.find((s) => s.month === month);
  const report = draft && draft.month === month ? draft : current?.report || null;
  const slides = useMemo(() => (report ? slidesOf(report) : []), [report]);

  const make = async (m: string) => {
    setBusy(true);
    setInfo("");
    setError("");
    try {
      const sources = await track(loadTvCompetitors()).catch(() => []);
      // Admin-only extras for the เชิงลึก pages; either may be missing and the pages are then left out.
      const yt = await track(loadYtAnalytics()).catch(() => null);
      let gains = null;
      try {
        const first = await firstGrowthDay();
        const p = monthPeriod(m);
        if (first && first <= p.end) gains = await track(loadGrowthDays(daysBetween(first > p.start ? first : p.start, p.end)));
      } catch {
        gains = null;
      }
      const r = buildMonthlyReport(rows, m, sources, { createdAt: new Date().toISOString(), createdBy: userName, dataAt: latestDate }, { yt, gains });
      setDraft(r);
      setMonth(m);
      setInfo(`ร่างรายงาน ${monthLabel(m)} ยังไม่ได้บันทึก · ตรวจแล้วกด "บันทึกรายงาน" เพื่อให้คนที่มีสิทธิ์เห็น${yt ? "" : " · อ่านข้อมูล YouTube Analytics ไม่ได้ จึงไม่มีหน้าเชิงลึก A, B และ SEO"}`);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const replacing = saved?.some((s) => s.month === draft.month);
    if (replacing && !window.confirm(`มีรายงาน ${monthLabel(draft.month)} อยู่แล้ว บันทึกทับด้วยตัวเลข ณ วันที่ ${dateLabel(draft.dataAt, true)}?`)) return;
    setBusy(true);
    try {
      await saveMonthlyReport(draft, userName);
      setDraft(null);
      setInfo(`บันทึกรายงาน ${monthLabel(draft.month)} แล้ว`);
      reload();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // PDF: the browser's own print → "Save as PDF"; every page carries who took it.
  const downloadPdf = () => {
    if (!report) return;
    const stamp = new Date().toLocaleString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
    setWatermark(`เอกสารภายใน TERO · ${userName} · ${stamp}`);
    recordDownload("monthly-report-pdf", `รายงานประจำเดือน ${report.month}${draft && draft.month === month ? " (ร่าง)" : ""}`);
    document.body.classList.add("mr-printing");
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove("mr-printing");
      setWatermark("");
    }, 300);
  };

  // Presenting: one page at a time, full screen; ← → or click to move, Esc to leave.
  useEffect(() => {
    if (present === null) return;
    const el = presentRef.current;
    if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") setPresent((p) => (p === null ? p : Math.min(slides.length - 1, p + 1)));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setPresent((p) => (p === null ? p : Math.max(0, p - 1)));
      if (e.key === "Escape") setPresent(null);
    };
    const onExit = () => {
      if (!document.fullscreenElement) setPresent(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onExit);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onExit);
    };
  }, [present, slides.length]);
  const closePresent = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    setPresent(null);
  };

  const months = [...new Set([...(saved || []).map((s) => s.month), ...(draft ? [draft.month] : [])])].sort().reverse();
  const isDraft = !!draft && draft.month === month;

  return (
    <section className="panel growth-panel monthly-report" id="monthly-report">
      <div className="panel-head mr-toolbar">
        <div>
          <h2>รายงานประจำเดือน</h2>
          <p className="growth-sub">สรุปรายเดือนสำหรับประชุม · ตัวเลขถูกเก็บไว้ ณ วันที่ทำรายงาน ไม่ขยับตามข้อมูลใหม่ · เอกสารภายใน</p>
        </div>
        <div className="mr-actions">
          {months.length > 0 && (
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="เลือกเดือน">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                  {draft && draft.month === m ? " (ร่าง)" : ""}
                </option>
              ))}
            </select>
          )}
          {report && (
            <button type="button" onClick={() => setPresent(0)}>
              <Maximize size={15} /> นำเสนอเต็มจอ
            </button>
          )}
          {report && isAdmin && (
            <button type="button" onClick={downloadPdf}>
              <FileDown size={15} /> ดาวน์โหลด PDF
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mr-admin">
          <span>admin:</span>
          <button type="button" disabled={busy || !suggested || !rows.length} onClick={() => make(suggested)}>
            <RefreshCw size={14} /> {saved?.some((s) => s.month === suggested) ? `ทำรายงาน ${monthLabel(suggested)} ใหม่` : `สร้างรายงาน ${suggested ? monthLabel(suggested) : ""}`}
          </button>
          <label>
            เดือนอื่น
            <input type="month" max={suggested} onChange={(e) => e.target.value && make(e.target.value)} disabled={busy} />
          </label>
          {isDraft && (
            <button type="button" className="mr-primary" disabled={busy} onClick={save}>
              บันทึกรายงาน
            </button>
          )}
          {isDraft && (
            <button type="button" disabled={busy} onClick={() => setDraft(null)}>
              ยกเลิกร่าง
            </button>
          )}
        </div>
      )}
      {info && <p className="growth-notice">{info}</p>}
      {error && <p className="growth-notice warn">{error.includes("permission") ? "ไม่มีสิทธิ์ดูรายงานประจำเดือน ติดต่อ admin" : error}</p>}
      {saved && !report && !error && (
        <p className="growth-notice">{isAdmin ? `ยังไม่มีรายงานที่บันทึกไว้ · กด "สร้างรายงาน" เพื่อเริ่ม` : "ยังไม่มีรายงานประจำเดือน"}</p>
      )}
      {report && (
        <p className="mr-meta">
          {isDraft ? "ร่าง (ยังไม่บันทึก)" : `บันทึกโดย ${current?.savedByName || "-"}`} · ข้อมูล ณ วันที่ {dateLabel(report.dataAt, true)} · {slides.length} หน้า
        </p>
      )}

      <div className="mr-deck">
        {report &&
          slides.map((s, i) =>
            s.cover ? (
              <section key={i} className="mr-slide mr-cover-slide">
                {s.body}
                {watermark && (
                  <div className="mr-watermark" aria-hidden>
                    {Array.from({ length: 6 }, (_, j) => (
                      <span key={j}>{watermark}</span>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <Slide key={i} report={report} n={i + 1} total={slides.length} title={s.title} watermark={watermark}>
                {s.body}
              </Slide>
            ),
          )}
      </div>

      {present !== null && report && (
        <div className="mr-present" ref={presentRef} onClick={() => setPresent((p) => (p === null ? p : Math.min(slides.length - 1, p + 1)))}>
          <div className="mr-present-stage">
            {slides[present].cover ? (
              <section className="mr-slide mr-cover-slide">{slides[present].body}</section>
            ) : (
              <Slide report={report} n={present + 1} total={slides.length} title={slides[present].title} watermark="">
                {slides[present].body}
              </Slide>
            )}
          </div>
          <div className="mr-present-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPresent(Math.max(0, present - 1))} aria-label="หน้าก่อน">
              <ChevronLeft size={18} />
            </button>
            <span>
              {present + 1} / {slides.length}
            </span>
            <button type="button" onClick={() => setPresent(Math.min(slides.length - 1, present + 1))} aria-label="หน้าถัดไป">
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={closePresent} aria-label="ออกจากโหมดนำเสนอ">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
