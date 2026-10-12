"use client";
// Audience Report: views by posting hour, likes / comments per platform and
// Facebook post CTR, for clips posted in the report range (lib/dashboard/audience.ts).
import { useMemo, useState } from "react";
import { Heart, MessageCircle, MessagesSquare, MousePointerClick } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, dateLabel, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { audienceTotals, engagementByPlatform, facebookCtr, topCommented, viewsByPostHour } from "@/lib/dashboard/audience";
import { Kpi } from "@/components/dashboard/shared/Kpi";
import { Growth } from "@/components/dashboard/shared/Growth";
import { Empty } from "@/components/dashboard/shared/Empty";

interface Props {
  /** Clips posted in the report range that pass the filters. */
  rows: RecordRow[];
  /** The same for the compare range ([] without one). */
  prevRows: RecordRow[];
  grain: "day" | "month";
  compareText: string;
}

const LIKE = "#2563eb";
const COMMENT = "#ea580c";
/**
 * Total likes and comments per platform in two columns, each with its own heading
 * and scale, so platforms are compared within a column (not likes against comments).
 */
function PlatformRates({ platforms }: { platforms: ReturnType<typeof engagementByPlatform> }) {
  const list = [...platforms].sort((a, b) => b.comments - a.comments);
  const maxLike = Math.max(0, ...list.map((p) => p.likes));
  const maxComment = Math.max(0, ...list.map((p) => p.comments));
  const topLike = [...list].sort((a, b) => b.likes - a.likes)[0];
  const topComment = list[0];
  return (
    <div className="aud-rates">
      <div className="aud-rate aud-rate-head">
        <span />
        <span style={{ color: LIKE }}>Like รวม</span>
        <span style={{ color: COMMENT }}>คอมเมนต์รวม</span>
      </div>
      {list.map((p) => (
        <div key={p.platform} className="aud-rate">
          <span className="aud-rate-name">
            <i style={{ background: PLATFORM_COLORS[p.platform] || "#64748b" }} />
            {p.platform}
          </span>
          <span className="aud-rate-cell" title={`${p.platform} · Like ${num(p.likes)} · วิว ${num(p.views)}`}>
            <span className="aud-rate-bar">
              <span style={{ width: maxLike ? `${(p.likes / maxLike) * 100}%` : 0, background: LIKE }} />
            </span>
            <b style={{ color: LIKE }}>{compact(p.likes)}</b>
          </span>
          <span className="aud-rate-cell" title={`${p.platform} · คอมเมนต์ ${num(p.comments)} · วิว ${num(p.views)}`}>
            <span className="aud-rate-bar">
              <span style={{ width: maxComment ? `${(p.comments / maxComment) * 100}%` : 0, background: COMMENT }} />
            </span>
            <b style={{ color: COMMENT }}>{compact(p.comments)}</b>
          </span>
        </div>
      ))}
      {topLike && topComment && (
        <p className="aud-rate-sum">
          {topLike.platform === topComment.platform
            ? `${topLike.platform} ได้ Like และคอมเมนต์มากที่สุด`
            : `${topLike.platform} ได้ Like มากที่สุด · ${topComment.platform} ได้คอมเมนต์มากที่สุด`}
        </p>
      )}
    </div>
  );
}

const change = (a: number | null, b: number | null) => (a !== null && b ? (a - b) / b : null);

export function AudienceReport({ rows, prevRows, grain, compareText }: Props) {
  const now = useMemo(() => audienceTotals(rows), [rows]);
  const prev = useMemo(() => (prevRows.length ? audienceTotals(prevRows) : null), [prevRows]);
  const hours = useMemo(() => viewsByPostHour(rows), [rows]);
  const platforms = useMemo(() => engagementByPlatform(rows), [rows]);
  const talked = useMemo(() => topCommented(rows), [rows]);
  const ctr = useMemo(() => facebookCtr(rows, grain), [rows, grain]);
  const [hourMode, setHourMode] = useState<"total" | "median">("total");

  return (
    <section className="panel full audience-report" id="audience">
      <div className="panel-head">
        <div>
          <h2>Audience Report</h2>
          <p>คนดูตอบสนองกับคลิปที่โพสต์ในช่วงนี้อย่างไร · ตามตัวกรองด้านบน · เฉพาะออนไลน์</p>
        </div>
      </div>

      <div className="kpi-grid audience-kpis">
        <Kpi tone="violet" icon={<Heart />} label="Like รวม" value={compact(now.likes)} growth={<Growth value={change(now.likes, prev?.likes ?? null)} title={compareText} />} detail="ทุกแพลตฟอร์ม" />
        <Kpi tone="blue" icon={<MessageCircle />} label="Comment รวม" value={compact(now.comments)} growth={<Growth value={change(now.comments, prev?.comments ?? null)} title={compareText} />} detail="ทุกแพลตฟอร์ม" />
        <Kpi
          tone="indigo"
          icon={<MessagesSquare />}
          label="Comment ต่อ 1,000 วิว"
          value={now.commentsPer1k.toFixed(2)}
          growth={<Growth value={change(now.commentsPer1k, prev?.commentsPer1k ?? null)} title={compareText} />}
          detail="คนคุยกันมากแค่ไหนเมื่อเทียบกับคนดู"
        />
        <Kpi
          tone="orange"
          icon={<MousePointerClick />}
          label="CTR Facebook Post"
          value={now.ctr === null ? "-" : `${(now.ctr * 100).toFixed(2)}%`}
          growth={<Growth value={change(now.ctr, prev?.ctr ?? null)} title={compareText} />}
          detail={now.ctr === null ? "ข้อมูลคลิกจะเริ่มมีหลัง sync รอบถัดไป" : `คลิก ÷ การเห็น · ${num(now.ctrPosts)} โพสต์`}
        />
      </div>

      <article className="audience-box">
        <div className="audience-box-head">
          <div>
            <h3>ยอดวิวรวมตามเวลาที่ลงโพสต์</h3>
            <p>
              เวลาไทยที่ลงคลิป · มีเวลาโพสต์ {num(hours.withTime)} จาก {num(hours.total)} คลิป (แถวที่ทีมกรอกเองไม่มีเวลาโพสต์)
            </p>
          </div>
          <div className="segmented chart-type-toggle">
            <button className={hourMode === "total" ? "active" : ""} onClick={() => setHourMode("total")}>
              วิวรวม
            </button>
            <button className={hourMode === "median" ? "active" : ""} onClick={() => setHourMode("median")}>
              วิวต่อคลิป (ค่ากลาง)
            </button>
          </div>
        </div>
        <div className="chart-lg">
          {hours.withTime ? (
            <ResponsiveContainer>
              <ComposedChart data={hours.points}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={1} />
                <YAxis yAxisId="v" tickFormatter={compact} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="c" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => [num(Number(v)), String(name)]} />
                <Legend />
                {hourMode === "total"
                  ? hours.platforms.map((p) => (
                      <Bar key={p} yAxisId="v" dataKey={p} stackId="v" fill={PLATFORM_COLORS[p] || "#64748b"} />
                    ))
                  : <Bar yAxisId="v" dataKey="medianViews" name="วิวต่อคลิป (ค่ากลาง)" fill="#0757e8" radius={[4, 4, 0, 0]} />}
                <Line yAxisId="c" type="monotone" dataKey="clips" name="จำนวนคลิปที่ลง" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </div>
        <p className="audience-note">ชั่วโมงที่ลงคลิปเยอะ วิวรวมจะสูงตามจำนวนคลิป ดู “วิวต่อคลิป” เพื่อเทียบว่าลงกี่โมงแล้วแต่ละคลิปได้ผลดี</p>
      </article>

      <div className="audience-pair">
        <article className="audience-box">
          <div className="audience-box-head">
            <div>
              <h3>Like &amp; Comment แยกแพลตฟอร์ม</h3>
              <p>จำนวนจริงของคลิปที่โพสต์ในช่วงนี้ · เรียงตามคอมเมนต์ · ชี้แท่งเพื่อดูตัวเลขเต็ม</p>
            </div>
          </div>
          {platforms.length ? (
            <>
              <PlatformRates platforms={platforms} />
              {talked.length > 0 && (
                <>
                  <h4 className="audience-top-head">คลิปที่คนคอมเมนต์มากที่สุด</h4>
                  <ol className="audience-top">
                    {talked.map(({ row: r }, i) => (
                      <li key={`${r.platform}-${r.contentId || r.url}-${i}`}>
                        <a href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
                          {r.topic || "ไม่ระบุประเด็น"}
                        </a>
                        <small>
                          {r.platform} · {compact(r.comments)} คอมเมนต์ · {compact(r.likes)} Like · {compact(r.views)} วิว
                        </small>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          ) : (
            <Empty />
          )}
        </article>

        <article className="audience-box">
          <div className="audience-box-head">
            <div>
              <h3>CTR ของ Facebook Post</h3>
              <p>คลิก ÷ การเห็น · {grain === "day" ? "รายวัน" : "รายเดือน"} · ค่าดิบจาก Metricool</p>
            </div>
          </div>
          {ctr.posts ? (
            <>
              <div className="chart-md">
                <ResponsiveContainer>
                  <LineChart data={ctr.trend}>
                    <CartesianGrid vertical={false} stroke="#e8edf5" />
                    <XAxis dataKey="date" tickFormatter={(v) => (grain === "day" ? dateLabel(v) : v)} tick={{ fontSize: 11 }} />
                    <YAxis unit="%" tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      formatter={(v, name) => (name === "CTR" ? `${Number(v).toFixed(2)}%` : num(Number(v)))}
                      labelFormatter={(v) => (grain === "day" ? dateLabel(String(v)) : String(v))}
                    />
                    <Line type="monotone" dataKey="ctr" name="CTR" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ol className="audience-top">
                {ctr.top.map((r, i) => (
                  <li key={`${r.contentId}-${i}`}>
                    <a href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
                      {r.topic || "ไม่ระบุประเด็น"}
                    </a>
                    <small>
                      {num(r.clicks || 0)} คลิก · CTR {r.impressions ? (((r.clicks || 0) / r.impressions) * 100).toFixed(2) : "0.00"}%
                    </small>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="growth-notice">ยังไม่มีข้อมูลคลิกของ Facebook Post ในช่วงนี้ · ระบบเริ่มเก็บจาก sync รอบถัดไป (โพสต์ใน 90 วันล่าสุด)</p>
          )}
        </article>
      </div>
    </section>
  );
}
