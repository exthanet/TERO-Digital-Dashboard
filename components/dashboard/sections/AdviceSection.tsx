"use client";
// Advanced → คำแนะนำ: rule-based advice (lib/dashboard/advice.ts) for the
// clips posted in the report range, with the numbers and clips behind each.
import { useMemo, useState } from "react";
import { ChevronDown, CircleAlert, Info, Sparkles } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact } from "@/lib/dashboard/format";
import { computeAdvice, type Advice, type AdviceLevel } from "@/lib/dashboard/advice";

const thDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "";

const LEVEL: Record<AdviceLevel, { label: string; icon: React.ReactNode }> = {
  good: { label: "โอกาส", icon: <Sparkles size={14} /> },
  warn: { label: "ควรระวัง", icon: <CircleAlert size={14} /> },
  info: { label: "ข้อมูลน่ารู้", icon: <Info size={14} /> },
};

interface Props {
  /** Clips posted in the report range that pass the filters. */
  rows: RecordRow[];
  /** Same filters without the date: the compare range is taken from these. */
  allRows: RecordRow[];
  startDate: string;
  endDate: string;
  latestDate: string;
  comparePeriod: { start: string; end: string } | null;
}

function AdviceCard({ a }: { a: Advice }) {
  const [open, setOpen] = useState<"" | "clips" | "criteria">("");
  return (
    <article className={`advice-card ${a.level}`}>
      <header>
        <span className={`advice-level ${a.level}`}>
          {LEVEL[a.level].icon} {LEVEL[a.level].label}
        </span>
        <small>
          กฎข้อ {a.rule} · {a.group}
        </small>
      </header>
      <h3>{a.title}</h3>
      <p>
        <b>สิ่งที่เห็น:</b> {a.seen}
      </p>
      <p>
        <b>ข้อแนะนำ:</b> {a.action}
      </p>
      {a.correlation && <p className="advice-caution">เป็นความสัมพันธ์จากข้อมูล ไม่ได้พิสูจน์ว่าเป็นสาเหตุ ควรทดลองเพื่อยืนยัน</p>}
      <div className="advice-actions">
        <button type="button" className={open === "clips" ? "active" : ""} onClick={() => setOpen(open === "clips" ? "" : "clips")}>
          ดูคลิปที่เกี่ยวข้อง ({a.clips.length}) <ChevronDown size={14} />
        </button>
        <button type="button" className={open === "criteria" ? "active" : ""} onClick={() => setOpen(open === "criteria" ? "" : "criteria")}>
          เกณฑ์ที่ใช้ <ChevronDown size={14} />
        </button>
      </div>
      {open === "clips" && (
        <ol className="advice-clips">
          {a.clips.map((r, i) => (
            <li key={`${r.contentId || r.url}-${i}`}>
              <a href={r.url || undefined} target="_blank" rel="noreferrer" title={r.topic}>
                {r.topic || "ไม่ระบุประเด็น"}
              </a>
              <small>
                {thDate(r.date)} · {compact(r.views)} วิว
              </small>
            </li>
          ))}
        </ol>
      )}
      {open === "criteria" && <p className="advice-criteria">{a.criteria}</p>}
    </article>
  );
}

export function AdviceSection({ rows, allRows, startDate, endDate, latestDate, comparePeriod }: Props) {
  const prev = useMemo(
    () => (comparePeriod ? allRows.filter((r) => r.date >= comparePeriod.start && r.date <= comparePeriod.end) : []),
    [allRows, comparePeriod],
  );
  const result = useMemo(() => computeAdvice(rows, prev, latestDate), [rows, prev, latestDate]);
  const [level, setLevel] = useState<AdviceLevel | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const shown = result.items.filter((a) => level === "all" || a.level === level);
  const visible = showAll ? shown : shown.slice(0, 10);
  const count = (l: AdviceLevel) => result.items.filter((a) => a.level === l).length;

  return (
    <section className="panel growth-panel" id="advice">
      <div className="panel-head">
        <div>
          <h2>คำแนะนำ: สิ่งที่ข้อมูลบอกและควรลองทำ</h2>
          <p className="growth-sub">
            จากคลิปที่โพสต์ในช่วง {thDate(startDate)} – {thDate(endDate)} ตามตัวกรองด้านบน · ใช้กฎตายตัว (ไม่ใช่ AI)
            ทุกข้อแสดงตัวเลขและคลิปที่ใช้ตัดสิน · เทียบเฉพาะ platform และรูปแบบเดียวกัน
          </p>
        </div>
        <div className="ranking-controls">
          <div className="segmented">
            <button className={level === "all" ? "active" : ""} onClick={() => setLevel("all")}>
              ทั้งหมด {result.items.length}
            </button>
            {(["good", "warn", "info"] as AdviceLevel[]).map((l) => (
              <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
                {LEVEL[l].label} {count(l)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length ? (
        <div className="advice-list">
          {visible.map((a, i) => (
            <AdviceCard key={`${a.rule}-${a.group}-${a.title}-${i}`} a={a} />
          ))}
        </div>
      ) : (
        <p className="growth-notice">ไม่มีคำแนะนำในกลุ่มนี้สำหรับช่วงที่เลือก</p>
      )}
      {shown.length > 10 && (
        <button type="button" className="ranking-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "แสดง 10 ข้อแรก" : `แสดงทั้งหมด ${shown.length} ข้อ`}
        </button>
      )}

      {(result.nothingFound.length > 0 || result.notEnough.length > 0) && (
        <div className="advice-status">
          {result.nothingFound.length > 0 && (
            <p>
              <b>ตรวจแล้ว ไม่พบสิ่งที่ต่างจากปกติชัดเจน:</b> {result.nothingFound.map((r) => `ข้อ ${r.rule} ${r.name}`).join(" · ")}
            </p>
          )}
          {result.notEnough.length > 0 && (
            <p>
              <b>ข้อมูลยังไม่พอสรุป:</b>{" "}
              {result.notEnough.map((r) => `ข้อ ${r.rule} ${r.name} (ต้องมี${r.need})`).join(" · ")}
              {!comparePeriod && result.notEnough.some((r) => r.rule === 5) && " · ข้อ 5 ต้องเลือกช่วงเปรียบเทียบ"}
            </p>
          )}
        </div>
      )}

      <p className="ai-note growth-note">
        ค่ากลาง = มัธยฐาน · ไม่นับคลิปที่โพสต์ไม่ถึง 2 วันในการเทียบวิว (ยอดยังเพิ่มอยู่) · ตัวเลขทั้งหมดเป็นค่าดิบจาก API ไม่มีการปรับ ·
        กฎที่ใช้ข้อมูลรายวัน (ภาพปก/ชื่อคลิป, คลิปเก่าที่กลับมา, platform ที่โต/ลด) จะเพิ่มเมื่อข้อมูลรายวันสะสมพอ
      </p>
    </section>
  );
}
