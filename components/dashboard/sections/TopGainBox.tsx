"use client";
// วิเคราะห์เชิงลึก → การเติบโต: the clips that really gained the most views in the date
// range (growthDaily, lib/dashboard/growth.ts summarizeGrowth), whatever day they were
// posted. Same numbers as before; shown first, by platform, 10 at a time (up to 20).
import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Flame } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { num } from "@/lib/dashboard/format";
import { addDays, gainShare, type GrowthClip } from "@/lib/dashboard/growth";

const PLATFORMS = ["ทั้งหมด", "YouTube", "TikTok", "Facebook", "Instagram"] as const;
const TOP = 10;
const MAX = 20;
/** Posted this many days or more before the range: "คลิปเก่ากลับมาวิ่ง". */
const OLD_DAYS = 7;

const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${iso}T00:00:00Z`)) : "");

export function TopGainBox({ clips, startDate, endDate, onOpen }: { clips: GrowthClip[]; startDate: string; endDate: string; onOpen: (r: RecordRow) => void }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("ทั้งหมด");
  const [all, setAll] = useState(false);
  const list = useMemo(() => (platform === "ทั้งหมด" ? clips : clips.filter((c) => c.row.platform === platform)).filter((c) => c.views > 0), [clips, platform]);
  const shown = list.slice(0, all ? MAX : TOP);
  const oldBefore = startDate ? addDays(startDate, -OLD_DAYS) : "";
  const oneDay = startDate === endDate;

  return (
    <article className="growth-table top-gain">
      <div className="top-gain-head">
        <h3>
          <Flame size={16} /> Top วิวที่เพิ่มขึ้นจริง{oneDay ? ` · ${thDate(startDate)}` : ""}
        </h3>
        <div className="segmented" role="group" aria-label="แพลตฟอร์ม">
          {PLATFORMS.map((p) => (
            <button key={p} className={platform === p ? "active" : ""} onClick={() => setPlatform(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <p className="growth-hint">
        คลิปที่ได้วิวเพิ่มมากที่สุดในช่วง {thDate(startDate)} – {thDate(endDate)} ไม่ว่าจะโพสต์เมื่อไร · เลือก “เมื่อวาน” ที่ตัวกรองวันที่ด้านบน = คลิปที่วิ่งดีเมื่อวาน · กดชื่อคลิปเพื่อวิเคราะห์คลิป
      </p>
      {shown.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>คลิป</th>
                <th>โพสต์เมื่อ</th>
                <th className="num">วิวที่เพิ่มในช่วงนี้</th>
                <th className="num">วิวสะสมล่าสุด</th>
                <th className="num" title="วิวที่เพิ่มในช่วงนี้ ÷ วิวสะสมล่าสุด: สูง = กำลังโต, ต่ำ = อิ่มตัวแล้ว">% ของวิวสะสม</th>
                <th className="num">Engagement ที่เพิ่ม</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c, i) => {
                const share = gainShare(c);
                const isNew = !!startDate && c.row.date >= startDate;
                const isOld = !!oldBefore && c.row.date < oldBefore;
                return (
                  <tr key={c.key}>
                    <td>{i + 1}</td>
                    <td className="growth-clip">
                      <span className="growth-clip-title">
                        <button type="button" className="clip-open" onClick={() => onOpen(c.row)} title="วิเคราะห์คลิปนี้">
                          {c.row.topic || "ไม่ระบุประเด็น"}
                        </button>
                        {c.row.url && (
                          <a href={c.row.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป" title="เปิดคลิป">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </span>
                      <small>
                        <span className="tag">{c.row.platform}</span> {c.row.vdoType}
                        {isNew && <span className="growth-tag new">ใหม่</span>}
                        {isOld && <span className="growth-tag old">คลิปเก่ากลับมาวิ่ง</span>}
                        {c.dropped && (
                          <span className="growth-tag drop" title="มีบางวันที่ตัวเลขจาก API ลดลง (แสดงตามจริง)">
                            <AlertTriangle size={11} /> ตัวเลขลดลง
                          </span>
                        )}
                      </small>
                    </td>
                    <td>{thDate(c.row.date)}</td>
                    <td className="num strong">{num(c.views)}</td>
                    <td className="num">{num(c.row.views)}</td>
                    <td className="num">{share === null ? "-" : `${Math.round(share * 100)}%`}</td>
                    <td className="num">{num(c.likes + c.comments + c.shares)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ranking-empty">ไม่มีคลิป{platform === "ทั้งหมด" ? "" : ` ${platform}`} ที่มีวิวเพิ่มในช่วงนี้</p>
      )}
      {list.length > TOP && (
        <button type="button" className="ranking-more" onClick={() => setAll((v) => !v)}>
          {all ? "แสดง 10 อันดับ" : `ดูทั้งหมด ${Math.min(MAX, list.length)} อันดับ`}
        </button>
      )}
      <p className="audience-note">
        ใหม่ = โพสต์ในช่วงนี้ (นับวิวตั้งแต่ 0) · คลิปเก่ากลับมาวิ่ง = โพสต์ก่อนช่วงนี้ {OLD_DAYS} วันขึ้นไป · % ของวิวสะสม สูง = กำลังโต ต่ำ = อิ่มตัว
      </p>
    </article>
  );
}
