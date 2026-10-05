"use client";
// Advanced → การเติบโต: content posted 2 weeks or more ago that still gains
// views almost every day (lib/dashboard/evergreen.ts), by age.
import { useMemo, useState } from "react";
import { ExternalLink, Leaf } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import {
  AGE_BANDS,
  EVERGREEN_FULL_DAYS,
  EVERGREEN_MIN_AGE,
  EVERGREEN_MIN_PER_DAY,
  EVERGREEN_MIN_SHARE,
  evergreenMix,
  type AgeBand,
  type EvergreenItem,
} from "@/lib/dashboard/evergreen";

const SHOWN = 15;
const TREND = { up: "↗ เพิ่มขึ้น", flat: "→ คงที่", down: "↘ ลดลง" } as const;

function Spark({ daily }: { daily: number[] }) {
  const max = Math.max(...daily, 1);
  return (
    <span className="evergreen-spark" aria-hidden="true">
      {daily.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v > 0 ? 1 : 0.25 }} />
      ))}
    </span>
  );
}

export function EvergreenBox({ items, daysWithData, onOpen }: { items: EvergreenItem[]; daysWithData: number; onOpen: (row: RecordRow) => void }) {
  const counts = useMemo(() => Object.fromEntries(AGE_BANDS.map((b) => [b.key, items.filter((x) => x.band === b.key).length])) as Record<AgeBand, number>, [items]);
  const [picked, setPicked] = useState<AgeBand | "">("");
  // Open on the youngest band that has content.
  const band: AgeBand = picked || AGE_BANDS.find((b) => counts[b.key] > 0)?.key || "2w-1m";
  const [all, setAll] = useState(false);
  const list = items.filter((x) => x.band === band);
  const shown = all ? list : list.slice(0, SHOWN);
  const topics = useMemo(() => evergreenMix(list, "topicType").slice(0, 4), [list]);
  const formats = useMemo(() => evergreenMix(list, "vdoType").slice(0, 3), [list]);
  const bandTotal = list.reduce((a, x) => a + x.total, 0);

  return (
    <article className="growth-table evergreen-box">
      <h3>
        <Leaf size={16} /> คอนเทนต์ที่ยังมีคนดูต่อเนื่อง (Evergreen)
      </h3>
      <p className="growth-hint">
        โพสต์มาแล้วอย่างน้อย {EVERGREEN_MIN_AGE} วัน และยังมีวิวเพิ่มอย่างน้อย {Math.round(EVERGREEN_MIN_SHARE * 100)}% ของวันที่มีข้อมูล เฉลี่ยตั้งแต่{" "}
        {num(EVERGREEN_MIN_PER_DAY)} วิว/วัน · รวมทุกแพลตฟอร์ม (จับคู่จากชื่อคลิป) · กดชื่อคลิปเพื่อดูวิเคราะห์
      </p>
      {daysWithData < EVERGREEN_FULL_DAYS && (
        <p className="growth-notice">
          มีข้อมูลรายวัน {daysWithData} วันในช่วงนี้ · “ต่อเนื่อง” จะน่าเชื่อถือเมื่อมีอย่างน้อย {EVERGREEN_FULL_DAYS} วัน (ข้อมูลรายวันเริ่ม 1 ต.ค. 2569)
        </p>
      )}

      <div className="segmented evergreen-bands">
        {AGE_BANDS.map((b) => (
          <button key={b.key} className={band === b.key ? "active" : ""} onClick={() => { setPicked(b.key); setAll(false); }}>
            {b.label} ({num(counts[b.key])})
          </button>
        ))}
      </div>

      {list.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>คลิป</th>
                  <th className="num">อายุ</th>
                  <th className="num">วิว/วัน</th>
                  <th>วันที่มีคนดู</th>
                  <th>แนวโน้ม</th>
                  <th className="num">เพิ่มรวมในช่วง</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x, i) => (
                  <tr key={x.group.key}>
                    <td>{i + 1}</td>
                    <td className="growth-clip">
                      <span className="growth-clip-title">
                        <button type="button" className="clip-open" onClick={() => onOpen(x.group.lead)} title="วิเคราะห์คลิปนี้">
                          {x.group.lead.topic || "ไม่ระบุประเด็น"}
                        </button>
                        {x.group.lead.url && (
                          <a href={x.group.lead.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป" title="เปิดคลิป">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </span>
                      <small>
                        <b style={{ color: PLATFORM_COLORS[x.topPlatform] || "#475569" }}>▲ {x.topPlatform}</b>
                        {x.group.platforms.length > 1 && ` · ${x.group.platforms.length} แพลตฟอร์ม`} · {x.group.lead.topicType || "ไม่ระบุ"}
                      </small>
                    </td>
                    <td className="num">{num(x.age)} วัน</td>
                    <td className="num strong">{compact(x.perDay)}</td>
                    <td>
                      <Spark daily={x.daily} />
                      <small className="early-sub">
                        {x.daysGaining}/{x.daily.length} วัน
                      </small>
                    </td>
                    <td className={`evergreen-trend ${x.trend || ""}`}>{x.trend ? TREND[x.trend] : "-"}</td>
                    <td className="num">{num(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length > SHOWN && (
            <button type="button" className="ranking-more" onClick={() => setAll((v) => !v)}>
              {all ? `แสดง ${SHOWN} อันดับแรก` : `ดูทั้งหมด ${num(list.length)} คอนเทนต์`}
            </button>
          )}
          <p className="audience-note">
            {list.length} คอนเทนต์ในกลุ่มนี้ได้วิวเพิ่มรวม {compact(bandTotal)} ในช่วงนี้ · Topic Type:{" "}
            {topics.map((t) => `${t.name} ${bandTotal ? Math.round((t.total / bandTotal) * 100) : 0}%`).join(" · ")} · รูปแบบ:{" "}
            {formats.map((t) => `${t.name} ${bandTotal ? Math.round((t.total / bandTotal) * 100) : 0}%`).join(" · ")}
          </p>
        </>
      ) : (
        <p className="ranking-empty">ยังไม่มีคอนเทนต์ที่เข้าเกณฑ์ในกลุ่มนี้</p>
      )}
    </article>
  );
}
