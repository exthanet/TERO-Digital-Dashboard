"use client";
// Advanced → การเติบโต: new clips ranked by how fast they started
// (lib/dashboard/earlySignal.ts). "โอกาสแมส" waits for a few weeks of history.
import { useState } from "react";
import { ExternalLink, Flame } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { MIN_PEERS, NEW_DAYS, type DayGain, type EarlyClip } from "@/lib/dashboard/earlySignal";
import type { ClipForecast } from "@/lib/dashboard/growthForecast";

const thDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "";
const SHOWN = 15;
/** Views per hour: whole numbers under 1,000, compact above. */
export const perHourText = (v: number) => (v < 1000 ? num(Math.round(v)) : compact(v));

export function levelText(c: EarlyClip): { label: string; tone: string; detail: string } {
  const pct = c.percentile === null ? "" : `เร็วกว่า ${Math.round(c.percentile * 100)}% ของ ${num(c.peers)} คลิปรูปแบบเดียวกัน`;
  if (c.level === "hot") return { label: "เริ่มต้นแรง", tone: "hot", detail: pct };
  if (c.level === "good") return { label: "ดีกว่าปกติ", tone: "good", detail: pct };
  if (c.level === "normal") return { label: "ปกติ", tone: "normal", detail: pct };
  if (c.level === "few") return { label: "ข้อมูลยังน้อย", tone: "muted", detail: `มีคลิปรูปแบบเดียวกันให้เทียบ ${num(c.peers)} คลิป (ต้องมี ${MIN_PEERS})` };
  return { label: "คำนวณไม่ได้", tone: "muted", detail: c.row.publishTime ? "เวลาวัดไม่อยู่ในช่วง 0.5–48 ชม. หลังโพสต์" : "ไม่มีเวลาโพสต์" };
}

/** More days than this: thin bars without labels (hover for the number). */
const DENSE_DAYS = 7;

/** Small bars: views gained on each day since the sync first saw the clip (hover for the number). */
export function DayBars({ points }: { points: DayGain[] }) {
  const max = Math.max(1, ...points.map((p) => p.views || 0));
  const dense = points.length > DENSE_DAYS;
  return (
    <span className={`early-bars${dense ? " dense" : ""}`} role="img" aria-label={points.map((p) => `${thDate(p.date)} ${p.views === null ? "ไม่มีข้อมูล" : num(p.views)}`).join(", ")}>
      {points.map((p) => (
        <span key={p.date} className="early-bar" title={`${thDate(p.date)} · ${p.views === null ? "ไม่มีข้อมูลวันนี้" : `+${num(p.views)} วิว`}`}>
          <span className="early-bar-track">
            {p.views === null ? (
              <i className="gap" />
            ) : (
              <i style={{ height: `${Math.max(p.views > 0 ? 6 : 0, (p.views / max) * 100)}%` }} />
            )}
          </span>
          {!dense && (
            <>
              <small>{compact(p.views || 0)}</small>
              <small className="early-bar-day">{thDate(p.date)}</small>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

/** "≈ 128K" with its usual range, growth left and how often the group was right. */
function ForecastCell({ f }: { f: ClipForecast | null }) {
  if (!f) return <td className="num muted" title="กลุ่มนี้ยังมีคลิปในอดีตไม่พอ">–</td>;
  return (
    <td className="num">
      <b>≈ {compact(f.expected)}</b>
      <small className="early-sub">
        {compact(f.low)}–{compact(f.high)} · {f.daysLeft === null ? "" : f.daysLeft > 0 ? `โตต่ออีก ~${f.daysLeft} วัน · ` : "ใกล้หมดแรง · "}ทายถูก {Math.round(f.hitRate * 100)}%
      </small>
    </td>
  );
}

export function EarlySignalBox({
  clips,
  gains,
  onOpen,
  forecast,
}: {
  clips: EarlyClip[];
  gains: Map<string, DayGain[]>;
  onOpen: (row: RecordRow) => void;
  /** Day-7 forecast from the case study (GrowthCaseStudy); null for a group it cannot forecast. */
  forecast?: (c: EarlyClip) => ClipForecast | null;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? clips : clips.slice(0, SHOWN);
  const hot = clips.filter((c) => c.level === "hot").length;
  return (
    <article className="growth-table early-box">
      <h3>
        <Flame size={16} /> คลิปใหม่ที่เริ่มต้นแรง
      </h3>
      <p className="growth-hint">
        คลิปที่โพสต์ใน {NEW_DAYS} วันล่าสุด {num(clips.length)} คลิป{hot ? ` · เริ่มต้นแรง ${num(hot)} คลิป` : ""} · วัดวิวรอบแรกที่ sync เจอ ÷ ชั่วโมงหลังโพสต์ · กราฟแท่ง = วิวที่เพิ่มแต่ละวันในช่วงที่เลือก
        แล้วเทียบกับคลิปรายการ แพลตฟอร์ม และรูปแบบเดียวกัน · กดชื่อคลิปเพื่อดูวิเคราะห์
      </p>
      {clips.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>คลิป</th>
                <th>โพสต์</th>
                <th className="num">วิวรอบแรก</th>
                <th className="num">วิว/ชม.</th>
                {forecast && (
                  <th className="num" title="วิววันแรก × ตัวคูณของกลุ่มจาก Case study · ช่วงปกติ = ครึ่งกลางของคลิปในอดีต">
                    คาดการณ์ 7 วัน
                  </th>
                )}
                <th title="วิวที่เพิ่มในแต่ละวันที่มีคนดู นับจากวันแรกที่ sync เจอคลิป (วันแรก = วิวรอบแรก)">วิวที่เพิ่มรายวัน</th>
                <th>เทียบคลิปรูปแบบเดียวกัน</th>
                <th className="num" title="Share และ Comment ต่อ 1,000 วิวในรอบแรก">Share · Comment /1K</th>
                <th>โอกาสแมส</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const lv = levelText(c);
                return (
                  <tr key={c.key}>
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
                      </small>
                    </td>
                    <td>
                      {thDate(c.row.date)}
                      <small className="early-sub">{c.row.publishTime ? `${c.row.publishTime} น.` : "ไม่มีเวลา"}</small>
                    </td>
                    <td className="num">
                      {num(c.firstViews)}
                      {c.hours !== null && <small className="early-sub">ใน {c.hours.toFixed(1)} ชม.</small>}
                    </td>
                    <td className="num strong">{c.perHour === null ? "-" : perHourText(c.perHour)}</td>
                    {forecast && <ForecastCell f={forecast(c)} />}
                    <td>{gains.get(c.key)?.length ? <DayBars points={gains.get(c.key)!} /> : "-"}</td>
                    <td>
                      <span className={`early-level ${lv.tone}`}>
                        {c.level === "hot" && <Flame size={12} />} {lv.label}
                      </span>
                      {lv.detail && <small className="early-detail">{lv.detail}</small>}
                    </td>
                    <td className="num">
                      {c.firstViews > 0 ? `${((c.shares / c.firstViews) * 1000).toFixed(1)} · ${((c.comments / c.firstViews) * 1000).toFixed(1)}` : "-"}
                    </td>
                    <td>
                      <span className="early-wait" title="ต้องมีประวัติคลิปที่ครบ 7 วันหลายสัปดาห์ก่อน จึงคำนวณจากสถิติจริงได้">
                        รอข้อมูล
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ranking-empty">ไม่มีคลิปใหม่ที่วัดได้ในช่วงนี้</p>
      )}
      {clips.length > SHOWN && (
        <button type="button" className="ranking-more" onClick={() => setAll((v) => !v)}>
          {all ? `แสดง ${SHOWN} คลิปแรก` : `ดูทั้งหมด ${num(clips.length)} คลิป`}
        </button>
      )}
      <p className="audience-note">
        “แมส” = ภายใน 7 วันติด 10% แรกของรายการ แพลตฟอร์ม และรูปแบบเดียวกัน · โอกาสแมสจะคำนวณจากสถิติจริงเมื่อมีประวัติพอ (ประมาณกลาง พ.ย. 2569)
        และจะแสดงผลทดสอบย้อนหลังด้วย · เป็นสัญญาณจากตัวเลข ไม่ได้รับประกันผล
      </p>
    </article>
  );
}
