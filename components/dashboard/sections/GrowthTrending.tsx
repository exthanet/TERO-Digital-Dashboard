"use client";
// การเติบโต → "คลิปที่คาดว่าจะมาแรง": the new clips still growing, five per platform,
// by their day-7 forecast from the case study (lib/dashboard/growthForecast.ts).
import { useEffect, useState } from "react";
import { ExternalLink, TrendingUp } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { recordKey } from "@/lib/dashboard/growth";
import type { ClipForecast } from "@/lib/dashboard/growthForecast";
import { loadThumbnails, thumbnailFor } from "@/lib/thumbnailData";
import { track } from "@/lib/loadingBar";

const COLORS: Record<string, string> = { ...PLATFORM_COLORS, TikTok: "#0f172a" };
const PLATFORMS = ["YouTube", "TikTok", "Facebook", "Instagram"];
const PER_PLATFORM = 5;
const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");
/** The title without its trailing hashtags (they stay in the link's tooltip). */
const titleOf = (t: string) => (t || "ไม่ระบุประเด็น").replace(/(\s*#\S+)+\s*$/u, "").trim() || t;

export interface TrendingItem {
  key: string;
  row: RecordRow;
  firstViews: number;
  forecast: ClipForecast;
}

function Cover({ row, stored }: { row: RecordRow; stored: Map<string, string> }) {
  const src = thumbnailFor(recordKey(row), stored);
  const [broken, setBroken] = useState(false);
  return <span className="gtr-cover">{src && !broken && <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />}</span>;
}

export function GrowthTrending({ items, onOpen }: { items: TrendingItem[]; onOpen: (row: RecordRow) => void }) {
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
  const byPlatform = PLATFORMS.map((p) => ({
    platform: p,
    list: items
      .filter((x) => x.row.platform === p && x.forecast.daysLeft !== 0)
      .sort((a, b) => b.forecast.expected - a.forecast.expected)
      .slice(0, PER_PLATFORM),
  }));
  return (
    <article className="growth-table gtr">
      <h3>
        <TrendingUp size={16} /> คลิปที่คาดว่าจะมาแรง (แยกแพลตฟอร์ม)
      </h3>
      <p className="growth-hint">
        คลิปใหม่ที่ยังโตต่อ (ยังไม่ถึงวันหมดแรงของกลุ่ม) · เรียงตามยอดคาดการณ์ 7 วัน = วิวรอบแรก × ตัวคูณของกลุ่มจาก Case study ด้านล่าง · กดชื่อคลิปเพื่อดูวิเคราะห์
      </p>
      <div className="gtr-grid">
        {byPlatform.map(({ platform, list }) => (
          <section key={platform} className="gtr-col">
            <h4>
              <i style={{ background: COLORS[platform] }} />
              {platform}
            </h4>
            {list.length ? (
              <ol>
                {list.map((x, i) => (
                  <li key={x.key}>
                    <b className="gtr-rank">{i + 1}</b>
                    <Cover row={x.row} stored={stored} />
                    <div className="gtr-main">
                      <span className="gtr-title">
                        <button type="button" className="clip-open" onClick={() => onOpen(x.row)} title={x.row.topic}>
                          {titleOf(x.row.topic)}
                        </button>
                        {x.row.url && (
                          <a href={x.row.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </span>
                      <small>
                        {x.row.vdoType} · {thDate(x.row.date)}
                        {x.row.publishTime ? ` ${x.row.publishTime}` : ""}
                      </small>
                      <span className="gtr-nums">
                        <span>
                          รอบแรก <b>{compact(x.firstViews)}</b>
                        </span>
                        <span className="gtr-arrow">→</span>
                        <span>
                          คาด 7 วัน <b className="gtr-exp">≈ {compact(x.forecast.expected)}</b>
                        </span>
                      </span>
                      <small>
                        ช่วงปกติ {compact(x.forecast.low)}–{compact(x.forecast.high)}
                        {x.forecast.daysLeft ? ` · โตต่ออีก ~${x.forecast.daysLeft} วัน` : ""} · กลุ่มนี้ทายถูก {Math.round(x.forecast.hitRate * 100)}%
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ps-muted">ไม่มีคลิปใหม่ที่คาดการณ์ได้ (กลุ่มยังมีคลิปในอดีตไม่ถึง 30 คลิป หรือหมดแรงแล้ว)</p>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
