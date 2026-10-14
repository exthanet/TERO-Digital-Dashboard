"use client";
// รายงานรายเดือน → "5 คลิปดีที่สุด" / "5 คลิปแย่ที่สุด": the month's content by views,
// as the Ranking ดี/แย่ card shows it by default (ranking.ts), with how it did against normal,
// each with the clip analysis numbers (clipDetail.ts) in plain words (clipPicks.ts).
import { useEffect, useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { rankContents } from "@/lib/dashboard/ranking";
import { clipDetail } from "@/lib/dashboard/clipDetail";
import { commonTopic, pickReasons } from "@/lib/dashboard/clipPicks";
import { recordKey } from "@/lib/dashboard/growth";
import { loadThumbnails, thumbnailFor } from "@/lib/thumbnailData";
import { track } from "@/lib/loadingBar";

const COLORS: Record<string, string> = { ...PLATFORM_COLORS, TikTok: "#0f172a" };
const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The cover of the content: its most viewed post with one (posts most viewed first). */
function Cover({ posts, stored }: { posts: RecordRow[]; stored: Map<string, string> }) {
  const [broken, setBroken] = useState<string[]>([]);
  const src = [...posts]
    .sort((a, b) => b.views - a.views)
    .map((p) => thumbnailFor(recordKey(p), stored))
    .find((s) => s && !broken.includes(s));
  return (
    <span className="cp-cover">
      {/* Eager, not lazy: the page is also printed to PDF. */}
      {src && <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, src])} />}
    </span>
  );
}

export function MonthlyClipPicks({ all, program, start, end, kind }: { all: RecordRow[]; program: string; start: string; end: string; kind: "best" | "worst" }) {
  const [stored, setStored] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    track(loadThumbnails())
      .then((m) => alive && setStored(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const picks = useMemo(() => {
    const ranked = rankContents(all, { start, end }, end, 5, "views");
    const month = all.filter((r) => r.platform !== "TV" && r.date >= start && r.date <= end && r.views > 0);
    const erMedian = median(month.map((r) => r.engagement / r.views));
    return {
      total: ranked.total,
      list: (kind === "best" ? ranked.best : ranked.worst).map((x) => {
        const d = clipDetail(x.group.lead, all, new Map(), []);
        const lead = d.posts.find((p) => p.row === x.group.lead) || d.posts[0];
        return {
          x,
          d,
          reasons: pickReasons({
            kind,
            index: x.index,
            baseline: x.baseline,
            platforms: x.group.platforms,
            er: d.er,
            erMedian,
            hour: lead?.hour ?? null,
            bestHour: lead?.bestHour?.hour ?? null,
            platform: x.group.lead.platform,
            vdoType: x.group.lead.vdoType,
          }),
        };
      }),
    };
  }, [all, start, end, kind]);

  const best = kind === "best";
  const topic = commonTopic(picks.list.map((p) => p.x.group.lead.topicType));
  return (
    <div className={`cp-page ${kind}`}>
      <p className="cp-intro">
        {best ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
        รายการ: {program} (ตามตัวกรองรายการของ Dashboard) · จาก {num(picks.total)} คลิปที่โพสต์ในเดือนนี้ · {best ? "วิวมากที่สุด" : "วิวน้อยที่สุด"} (เรียงแบบเดียวกับ Ranking ดี/แย่) · “ของปกติ” = เทียบวิวปกติของแพลตฟอร์มและรูปแบบเดียวกันใน 30 วันก่อน
        {best ? " · ลงหลายแพลตฟอร์มนับรวมเป็นคลิปเดียว" : " · ไม่นับคลิปที่วิวต่ำกว่า 50 (มักถูกลบหรือยังไม่นับ)"}
      </p>
      {picks.list.length ? (
        <ol className="cp-list">
          {picks.list.map(({ x, d, reasons }, i) => {
            const r = x.group.lead;
            return (
              <li key={x.group.key} className="cp-card">
                <b className="cp-rank">{i + 1}</b>
                <Cover posts={x.group.posts} stored={stored} />
                <div className="cp-main">
                  <a className="cp-title" href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
                    {r.topic || "ไม่ระบุประเด็น"}
                  </a>
                  <small className="cp-meta">
                    {thDate(x.group.date)}
                    {r.publishTime ? ` ${r.publishTime} น.` : ""} · {r.program}
                    {r.topicType ? ` · ${r.topicType}` : ""}
                  </small>
                  <span className="cp-plats">
                    {x.group.platforms.map((p) => (
                      <span key={p.platform}>
                        <i style={{ background: COLORS[p.platform] || "#64748b" }} />
                        {p.platform} {compact(p.views)}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="cp-num">
                  <b>{compact(x.group.views)}</b>
                  <small>วิวรวม</small>
                  {x.index !== null && <span className={`cp-index ${best ? "up" : "down"}`}>{x.index >= 1 ? `×${x.index.toFixed(1)} ของปกติ` : `${Math.round(x.index * 100)}% ของปกติ`}</span>}
                  <small className="cp-eng">
                    ER {(d.er * 100).toFixed(1)}% · Like {compact(d.likes)} · คอมเมนต์ {compact(d.comments)} · แชร์ {compact(d.shares)}
                  </small>
                </div>
                <ul className="cp-why">
                  {reasons.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ps-muted">ไม่มีคลิปที่จัดอันดับได้ในเดือนนี้</p>
      )}
      {topic && (
        <p className="cp-sum">
          {best ? "คลิปที่ดีที่สุด" : "คลิปที่แย่ที่สุด"}ส่วนใหญ่เป็นประเภท “{topic}”
        </p>
      )}
    </div>
  );
}
