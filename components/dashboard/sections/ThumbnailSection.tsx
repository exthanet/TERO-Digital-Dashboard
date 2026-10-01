"use client";
// Advanced → Thumbnail: covers of the strongest and weakest clips side by side,
// each clip's views against the median of its format (same platform, same range).
import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { GROWTH_MAX_DAYS, addDays, daysBetween, type GrowthEntry } from "@/lib/dashboard/growth";
import { THUMB_FRESH_DAYS, earlyViews, rankThumbnails, type ThumbClip } from "@/lib/dashboard/thumbnails";
import { loadGrowthDays } from "@/lib/growthData";
import { loadThumbnails, thumbnailFor } from "@/lib/thumbnailData";
import { HelpLink } from "@/components/dashboard/sections/HelpSection";

const thDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "2-digit" }) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`)) : "";
const times = (x: number) => (x >= 1 ? `${x.toFixed(1)}×` : `${Math.round(x * 100)}%`);

interface Props {
  /** Clips posted in the report range that pass the filters. */
  rows: RecordRow[];
  startDate: string;
  endDate: string;
  /** Latest day in the data: clips posted within the last two days are not ranked yet. */
  latestDate: string;
}

function Cover({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="thumb-img thumb-missing">
        <ImageOff size={18} />
        <span>{src ? "ลิงก์รูปหมดอายุ" : "ไม่มีรูปปก"}</span>
      </div>
    );
  }
  return <img className="thumb-img" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

function Card({ clip, src }: { clip: ThumbClip; src: string }) {
  const r = clip.row;
  const er = r.views > 0 ? r.engagement / r.views : 0;
  return (
    <article className="thumb-card">
      <a href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
        <Cover src={src} alt={r.topic} />
      </a>
      <div className="thumb-body">
        <a className="thumb-title" href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
          {r.topic || "ไม่ระบุประเด็น"}
        </a>
        <small>
          <span className="tag">{r.vdoType}</span> {thDate(r.date)}
        </small>
        <div className="thumb-metrics">
          <div>
            <b>{compact(r.views)}</b>
            <span>วิว</span>
          </div>
          <div className={clip.index === null ? "" : clip.index >= 1 ? "up" : "down"}>
            <b>{clip.index === null ? "-" : times(clip.index)}</b>
            <span>ของค่ากลาง</span>
          </div>
          <div>
            <b>{(er * 100).toFixed(1)}%</b>
            <span>ER</span>
          </div>
        </div>
        {clip.early !== null && (
          <p className="thumb-early">
            2 วันแรก {compact(clip.early)} วิว{clip.earlyIndex !== null && ` (${times(clip.earlyIndex)} ของค่ากลาง)`}
          </p>
        )}
      </div>
    </article>
  );
}

export function ThumbnailSection({ rows, startDate, endDate, latestDate }: Props) {
  const digital = useMemo(() => rows.filter((r) => r.platform !== "TV"), [rows]);
  const platforms = useMemo(() => {
    const views = new Map<string, number>();
    for (const r of digital) views.set(r.platform, (views.get(r.platform) || 0) + r.views);
    return [...views.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [digital]);
  const [picked, setPicked] = useState("");
  const platform = platforms.includes(picked) ? picked : platforms.includes("YouTube") ? "YouTube" : platforms[0] || "";
  const [side, setSide] = useState<"best" | "worst">("best");
  const [limit, setLimit] = useState(12);

  const [stored, setStored] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    loadThumbnails()
      .then(setStored)
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  // Daily growth around the range gives each new clip's first-two-day views.
  const [growth, setGrowth] = useState<Map<string, GrowthEntry[] | null>>(new Map());
  useEffect(() => {
    if (!startDate || !endDate) return;
    const days = daysBetween(addDays(startDate, -1), addDays(endDate, 1));
    if (days.length > GROWTH_MAX_DAYS) return setGrowth(new Map());
    let alive = true;
    loadGrowthDays(days)
      .then((m) => alive && setGrowth(m))
      .catch(() => alive && setGrowth(new Map()));
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);
  const early = useMemo(() => earlyViews(growth), [growth]);

  const ranked = useMemo(() => (platform ? rankThumbnails(digital, platform, latestDate || endDate, early) : null), [digital, platform, latestDate, endDate, early]);
  const list = useMemo(() => {
    if (!ranked) return [];
    const withIndex = ranked.clips.filter((c) => c.index !== null);
    return side === "best" ? ranked.clips.slice(0, limit) : [...withIndex].reverse().slice(0, limit);
  }, [ranked, side, limit]);

  const medians = useMemo(() => {
    const m = new Map<string, { median: number; n: number }>();
    for (const c of ranked?.clips || []) {
      if (c.median === null) continue;
      const x = m.get(c.row.vdoType) || { median: c.median, n: 0 };
      x.n++;
      m.set(c.row.vdoType, x);
    }
    return [...m.entries()];
  }, [ranked]);
  const missing = stored ? list.filter((c) => !thumbnailFor(c.key, stored)).length : 0;

  return (
    <section className="panel growth-panel" id="thumbnail">
      <div className="panel-head">
        <div>
          <h2>Thumbnail: ภาพปกของคลิปที่ดึงคนดูได้ดีและไม่ดี<HelpLink topic="thumbnail" /></h2>
          <p className="growth-sub">
            คลิปที่โพสต์ในช่วง {thDate(startDate, { day: "numeric", month: "short", year: "numeric" })} –{" "}
            {thDate(endDate, { day: "numeric", month: "short", year: "numeric" })} · เทียบวิวกับค่ากลางของคลิปรูปแบบเดียวกัน
            (เช่น Shorts เทียบกับ Shorts) เพื่อดูว่าภาพปก + ชื่อคลิปแบบไหนดึงคนได้
          </p>
        </div>
        <div className="ranking-controls">
          <div className="segmented">
            {platforms.map((p) => (
              <button key={p} className={platform === p ? "active" : ""} onClick={() => { setPicked(p); setLimit(12); }}>
                {p}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button className={side === "best" ? "active" : ""} onClick={() => { setSide("best"); setLimit(12); }}>
              ดีที่สุด
            </button>
            <button className={side === "worst" ? "active" : ""} onClick={() => { setSide("worst"); setLimit(12); }}>
              ต่ำสุด
            </button>
          </div>
        </div>
      </div>

      {error && <p className="growth-notice warn">โหลดลิงก์รูปปกไม่สำเร็จ: {error}</p>}
      {medians.length > 0 && (
        <p className="growth-notice">
          ค่ากลางวิวของ {platform}: {medians.map(([vt, x]) => `${vt} ${compact(x.median)} (${num(x.n)} คลิป)`).join(" · ")}
          {ranked && ranked.fresh > 0 && ` · ไม่นับ ${num(ranked.fresh)} คลิปที่โพสต์ไม่ถึง ${THUMB_FRESH_DAYS} วัน (ยอดยังเพิ่มอยู่)`}
        </p>
      )}
      {(platform === "Facebook" || platform === "Instagram") && (
        <p className="growth-notice">
          ลิงก์รูปของ {platform} หมดอายุในไม่กี่วัน ระบบอัปเดตให้ทุกวันเฉพาะคลิปใน 90 วันล่าสุด คลิปเก่ากว่านั้นอาจไม่มีรูป
        </p>
      )}

      {!stored && !error && <p className="growth-notice">กำลังโหลดรูปปก…</p>}
      {stored && (
        <>
          {list.length ? (
            <div className="thumb-grid">
              {list.map((c) => (
                <Card key={c.key} clip={c} src={thumbnailFor(c.key, stored)} />
              ))}
            </div>
          ) : (
            <p className="ranking-empty">ไม่มีคลิปให้เทียบในช่วงนี้ (ต้องมีอย่างน้อย 5 คลิปรูปแบบเดียวกัน)</p>
          )}
          {ranked && list.length >= limit && limit < 48 && (
            <button type="button" className="ranking-more" onClick={() => setLimit(48)}>
              แสดงเพิ่ม (สูงสุด 48 คลิป)
            </button>
          )}
          {missing > 0 && <p className="quality-line muted">{num(missing)} คลิปในหน้านี้ไม่มีรูปปก</p>}
        </>
      )}

      <p className="ai-note growth-note">
        ค่ากลาง = มัธยฐานวิวของคลิปรูปแบบเดียวกันใน platform เดียวกันที่โพสต์ในช่วงนี้ (ต้องมีอย่างน้อย 5 คลิป) · วิวเป็นค่าดิบจาก API ·
        "2 วันแรก" นับจากข้อมูลรายวัน (หน้าการเติบโต) จึงมีเฉพาะคลิปที่โพสต์หลังเริ่มเก็บข้อมูลรายวัน · CTR จริงของภาพปก
        (เห็นกี่ครั้ง กดกี่ครั้ง) ต้องใช้ YouTube Analytics ของบัญชีเจ้าของช่อง ซึ่งยังไม่ได้เชื่อม
      </p>
    </section>
  );
}
