"use client";
// รายงานประจำเดือน → the last five pages: parts of รายงานรวมแพลตฟอร์ม for the report's
// month, computed live from the current data every time the report opens (not frozen
// with the saved report, so these numbers can move after a sync; each page says so).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecordRow } from "@/lib/dashboard/types";
import { inRange } from "@/lib/dashboard/platformReport";
import { monthPeriod } from "@/lib/dashboard/monthlyReport";
import { CrossPlatform, HashtagReport, PlatformInsight } from "@/components/dashboard/sections/PlatformInsight";
import { CompetitorLines, DigitalVsTv, PlatformBars, PlatformShare, TopKpis, TopTopics } from "@/components/dashboard/sections/PlatformTop";

/** Width the pages are laid out at before they are scaled into the slide. */
const DESIGN_WIDTH = 1280;

/** Lays its content out at DESIGN_WIDTH and scales it down to fit the slide body (screen, presenting and PDF). */
function FitBox({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current;
      const i = inner.current;
      if (!o || !i) return;
      const s = Math.min(o.clientWidth / DESIGN_WIDTH, o.clientHeight / Math.max(1, i.scrollHeight));
      setScale(Number.isFinite(s) && s > 0 ? Math.min(1, s) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", fit);
    };
  }, []);
  return (
    <div className="mr-fit" ref={outer}>
      <div className="mr-fit-inner" ref={inner} style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function LiveNote({ dataAt }: { dataAt: string }) {
  // Set after mount so the page renders the same on the server and in the browser.
  const [now, setNow] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setNow(new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date())), 0);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <p className="mr-live-note">
      ตัวเลขสดจากรายงานรวมแพลตฟอร์ม · คำนวณ ณ {now || "…"} (ข้อมูลถึง {dataAt}) · ไม่ได้บันทึกไว้กับรายงาน จึงอาจต่างจากหน้าก่อนหน้าหลัง sync
    </p>
  );
}

interface LiveData {
  cur: RecordRow[];
  prev: RecordRow[];
  tv: RecordRow[];
  start: string;
  end: string;
  compareText: string;
}

const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");

/** The month's rows and the month before, as รายงานรวมแพลตฟอร์ม uses them. */
export function useLiveData(rows: RecordRow[], month: string, prevMonth: string): LiveData | null {
  return useMemo(() => {
    if (!month) return null;
    const p = monthPeriod(month);
    const q = prevMonth ? monthPeriod(prevMonth) : null;
    return {
      cur: inRange(rows, p.start, p.end),
      prev: q ? inRange(rows, q.start, q.end) : [],
      tv: rows.filter((r) => r.platform === "TV"),
      start: p.start,
      end: p.end,
      compareText: q ? `เทียบ ${thDate(q.start)} – ${thDate(q.end)}` : "",
    };
  }, [rows, month, prevMonth]);
}

/** The five live pages, in order (titles as the deck shows them). */
export function liveSlides(d: LiveData, dataAt: string): { title: string; cover?: boolean; body: React.ReactNode }[] {
  const page = (body: React.ReactNode) => (
    <div className="mr-live">
      <FitBox>{body}</FitBox>
      <LiveNote dataAt={dataAt} />
    </div>
  );
  return [
    {
      title: "รายงานรวมแพลตฟอร์ม · Cross Platform",
      body: page(
        <div className="mr-live-page">
          <CrossPlatform cur={d.cur} startDate={d.start} endDate={d.end} />
          <TopKpis cur={d.cur} prev={d.prev} compareText={d.compareText} />
        </div>,
      ),
    },
    {
      title: "รายงานรวมแพลตฟอร์ม · ภาพรวมแพลตฟอร์มและประเด็น",
      body: page(
        <div className="mr-live-page">
          <div className="pt-grid g2">
            <DigitalVsTv cur={d.cur} startDate={d.start} endDate={d.end} />
            <PlatformShare cur={d.cur} metric="views" />
          </div>
          <div className="pt-grid g11">
            <PlatformBars cur={d.cur} metric="views" />
            <TopTopics cur={d.cur} metric="views" />
          </div>
        </div>,
      ),
    },
    {
      title: "รายงานรวมแพลตฟอร์ม · Rating ถกไม่เถียง vs คู่แข่ง",
      body: page(
        <div className="mr-live-page">
          <CompetitorLines tvRows={d.tv} startDate={d.start} endDate={d.end} />
        </div>,
      ),
    },
    {
      title: "รายงานรวมแพลตฟอร์ม · Platform Insight",
      body: page(
        <div className="mr-live-page">
          <PlatformInsight cur={d.cur} prev={d.prev} startDate={d.start} endDate={d.end} compareText={d.compareText} />
        </div>,
      ),
    },
    {
      title: "รายงานรวมแพลตฟอร์ม · Hashtag Report",
      body: page(
        <div className="mr-live-page">
          <HashtagReport cur={d.cur} prev={d.prev} endDate={d.end} />
        </div>,
      ),
    },
  ];
}
