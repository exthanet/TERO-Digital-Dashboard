"use client";
// รายงานรายเดือน → "5 คลิปดีที่สุด" / "5 คลิปแย่ที่สุด": the month's content by views,
// by views in the first AGE_DAYS days after posting, every clip at the same age (clipAge.ts;
// a month before the daily data began keeps lifetime views, as Ranking ดี/แย่ shows them), with how it did against normal,
// each with the clip analysis numbers (clipDetail.ts) in plain words (clipPicks.ts).
import { useEffect, useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { rankContents } from "@/lib/dashboard/ranking";
import { AGE_DAYS, rankContentsAtAge } from "@/lib/dashboard/clipAge";
import { addDays, daysBetween, recordKey, type GrowthEntry } from "@/lib/dashboard/growth";
import type { ContentGroup } from "@/lib/dashboard/contentGroups";
import { firstGrowthDay, loadGrowthDays } from "@/lib/growthData";
import { clipDetail } from "@/lib/dashboard/clipDetail";
import { vsNormal } from "@/lib/dashboard/vsNormal";
import { commonTopic, pickReasons } from "@/lib/dashboard/clipPicks";
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
  // Views at the same age (first AGE_DAYS days) from the daily data, for a month the daily
  // data covers; an earlier month keeps the lifetime views (and says so).
  const [aging, setAging] = useState<{ state: "loading" | "aged" | "lifetime"; days?: Map<string, GrowthEntry[] | null> }>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      const first = await firstGrowthDay().catch(() => "");
      if (!first || first > start) return alive && setAging({ state: "lifetime" });
      const yesterday = new Date(Date.now() + 7 * 3600e3 - 864e5).toISOString().slice(0, 10);
      const last = addDays(end, AGE_DAYS - 1) < yesterday ? addDays(end, AGE_DAYS - 1) : yesterday;
      const days = await track(loadGrowthDays(daysBetween(start, last))).catch(() => null);
      if (alive) setAging(days ? { state: "aged", days } : { state: "lifetime" });
    })();
    return () => {
      alive = false;
    };
  }, [start, end]);
  const picks = useMemo(() => {
    const month = all.filter((r) => r.platform !== "TV" && r.date >= start && r.date <= end && r.views > 0);
    const erMedian = median(month.map((r) => r.engagement / r.views));
    const programRows = all;
    let total: number;
    let note = "";
    let chosen: { group: ContentGroup; views: number; platforms: { platform: string; views: number }[]; index: number | null; baseline: number | null }[];
    if (aging.state === "aged" && aging.days) {
      const r = rankContentsAtAge(programRows, { start, end }, aging.days);
      total = r.total;
      note = `จัดอันดับ ${num(r.ranked)} คลิป${r.young ? ` · ยังไม่ครบ ${AGE_DAYS} วัน ${num(r.young)} คลิป (ไม่นับ)` : ""}${r.noData ? ` · ไม่มีข้อมูลรายวัน ${num(r.noData)} คลิป` : ""}`;
      chosen = (kind === "best" ? r.best : r.worst).map((x) => ({ group: x.group, views: x.ageViews, platforms: x.agePlatforms, index: x.index, baseline: x.baseline }));
    } else {
      const r = rankContents(programRows, { start, end }, end, 5, "views");
      total = r.total;
      chosen = (kind === "best" ? r.best : r.worst).map((x) => ({ group: x.group, views: x.group.views, platforms: x.group.platforms, index: x.index, baseline: x.baseline }));
    }
    return {
      total,
      note,
      list: chosen.map((x) => {
        const d = clipDetail(x.group.lead, all, new Map(), []);
        const lead = d.posts.find((p) => p.row === x.group.lead) || d.posts[0];
        return {
          x,
          d,
          reasons: pickReasons({
            kind,
            index: x.index,
            baseline: x.baseline,
            platforms: x.platforms,
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
  }, [all, start, end, kind, aging]);

  const aged = aging.state === "aged";
  const best = kind === "best";
  const topic = commonTopic(picks.list.map((p) => p.x.group.lead.topicType));
  return (
    <div className={`cp-page ${kind}`}>
      <p className="cp-intro">
        {best ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
        รายการ: {program} (ตามตัวกรองรายการของ Dashboard) · จาก {num(picks.total)} คลิปที่โพสต์ในเดือนนี้ ·{" "}
        {aged
          ? `${best ? "วิวมากที่สุด" : "วิวน้อยที่สุด"}ใน ${AGE_DAYS} วันแรกหลังโพสต์ (ทุกคลิปเทียบที่อายุเท่ากัน) · ${picks.note} · “ปกติ” = ค่ากลางวิว ${AGE_DAYS} วันแรกของคลิปประเภทเดียวกันในเดือนนี้`
          : aging.state === "loading"
            ? "กำลังโหลดข้อมูลรายวัน…"
            : `${best ? "วิวมากที่สุด" : "วิวน้อยที่สุด"} (วิวสะสม: ข้อมูลรายวันเริ่ม 1 ต.ค. 2026 จึงเทียบที่อายุเท่ากันไม่ได้) · “ปกติ” = วิวปกติของแพลตฟอร์มและรูปแบบเดียวกันใน 30 วันก่อน`}
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
                    {x.platforms.map((p) => (
                      <span key={p.platform}>
                        <i style={{ background: COLORS[p.platform] || "#64748b" }} />
                        {p.platform} {compact(p.views)}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="cp-num">
                  <b>{compact(x.views)}</b>
                  <small>{aged ? `วิว ${AGE_DAYS} วันแรก` : "วิวรวม"}</small>
                  {x.index !== null && <span className={`cp-index ${best ? "up" : "down"}`}>{vsNormal(x.index)}</span>}
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
