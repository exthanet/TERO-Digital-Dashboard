"use client";
// รายงานประจำเดือน → the live pages: parts of รายงานรวมแพลตฟอร์ม for the report's
// month, computed live from the current data every time the report opens (not frozen
// with the saved report, so these numbers can move after a sync; each page says so).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecordRow } from "@/lib/dashboard/types";
import { inRange } from "@/lib/dashboard/platformReport";
import { monthPeriod } from "@/lib/dashboard/monthlyReport";
import { programLabel, programMatches } from "@/lib/dashboard/programFilter";
import { CrossPlatform, HashtagReport, PlatformInsight } from "@/components/dashboard/sections/PlatformInsight";
import { EngagementReport } from "@/components/dashboard/sections/EngagementReport";
import { MonthlyClipPicks } from "@/components/dashboard/sections/MonthlyClipPicks";
import { AffiliateMonthPage, hasAffiliateMonth } from "@/components/dashboard/sections/AffiliateMonthPage";
import type { AffiliateSheets } from "@/lib/dashboard/affiliateSheets";
import { RevenueMonthPage, hasRevenueMonth } from "@/components/dashboard/sections/RevenueMonthPage";
import type { RevenueData } from "@/lib/dashboard/revenueParser";
import type { RevenueItem } from "@/lib/dashboard/revenueApi";
import { CompetitorLines, DigitalVsTv, PlatformBars, PlatformShare, TopKpis, TopTopics } from "@/components/dashboard/sections/PlatformTop";

/** Widths a page may be laid out at before it is scaled into the slide: a tall page is laid out wider, so it gets shorter and is scaled down less. */
const DESIGN_WIDTHS = [1280, 1440, 1600, 1760];

/**
 * Lays its content out at the width (of DESIGN_WIDTHS) that lets it show largest,
 * then scales it to fit the slide body (screen, presenting and PDF): the page fills
 * the slide's width or height, never overflows it.
 */
function FitBox({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(DESIGN_WIDTHS[0]);
  // A page that fills the slide's height sits in the middle of its width.
  const [left, setLeft] = useState(0);
  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current;
      const i = inner.current;
      if (!o || !i || !o.clientWidth || !o.clientHeight) return;
      const was = i.style.width;
      let best = { w: DESIGN_WIDTHS[0], s: 0 };
      for (const w of DESIGN_WIDTHS) {
        i.style.width = `${w}px`;
        const s = Math.min(o.clientWidth / w, o.clientHeight / Math.max(1, i.scrollHeight));
        if (s > best.s + 0.005) best = { w, s };
        // Already as wide as the slide allows: a wider layout only makes it smaller.
        if (o.clientHeight / Math.max(1, i.scrollHeight) >= o.clientWidth / w) break;
      }
      i.style.width = was;
      setWidth(best.w);
      const s = Number.isFinite(best.s) && best.s > 0 ? Math.min(1, best.s) : 1;
      setScale(s);
      setLeft(Math.max(0, Math.round((o.clientWidth - best.w * s) / 2)));
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
      <div className="mr-fit-inner" ref={inner} style={{ width, left, transform: `scale(${scale})` }}>
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
  /** Every row: the clip pages compare with the 30 days before the month. */
  all: RecordRow[];
  /** The clip pages: rows of the dashboard's รายการ filter, and its name. */
  programRows: RecordRow[];
  programName: string;
  cur: RecordRow[];
  prev: RecordRow[];
  tv: RecordRow[];
  start: string;
  end: string;
  compareText: string;
}

const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");

/** The month's rows and the month before, as รายงานรวมแพลตฟอร์ม uses them. */
export function useLiveData(rows: RecordRow[], month: string, prevMonth: string, program = "ALL"): LiveData | null {
  return useMemo(() => {
    if (!month) return null;
    const p = monthPeriod(month);
    const q = prevMonth ? monthPeriod(prevMonth) : null;
    return {
      all: rows,
      programRows: rows.filter((r) => programMatches(program, r.program)),
      programName: programLabel(program),
      cur: inRange(rows, p.start, p.end),
      prev: q ? inRange(rows, q.start, q.end) : [],
      tv: rows.filter((r) => r.platform === "TV"),
      start: p.start,
      end: p.end,
      compareText: q ? `เทียบ ${thDate(q.start)} – ${thDate(q.end)}` : "",
    };
  }, [rows, month, prevMonth, program]);
}

/** The live pages, in order (titles as the deck shows them). */
export function liveSlides(
  d: LiveData,
  dataAt: string,
  affiliate?: AffiliateSheets | null,
  revenue?: { data: RevenueData | null; months: RevenueItem[] } | null,
): { title: string; cover?: boolean; body: React.ReactNode }[] {
  const month = d.start.slice(0, 7);
  const page = (body: React.ReactNode) => (
    <div className="mr-live">
      <FitBox>{body}</FitBox>
      <LiveNote dataAt={dataAt} />
    </div>
  );
  const pages: { title: string; cover?: boolean; body: React.ReactNode }[] = [
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
    {
      title: "Like & คอมเมนต์",
      body: page(
        <div className="mr-live-page">
          <EngagementReport cur={d.cur} prev={d.prev} compareText={d.compareText} />
        </div>,
      ),
    },
    {
      title: "5 คลิปดีที่สุดของเดือน",
      body: page(
        <div className="mr-live-page">
          <MonthlyClipPicks all={d.programRows} program={d.programName} start={d.start} end={d.end} kind="best" />
        </div>,
      ),
    },
    {
      title: "5 คลิปแย่ที่สุดของเดือน",
      body: page(
        <div className="mr-live-page">
          <MonthlyClipPicks all={d.programRows} program={d.programName} start={d.start} end={d.end} kind="worst" />
        </div>,
      ),
    },
  ];
  // Affiliate: only for who may see revenue (the sheets are not readable otherwise) and when the month was imported.
  if (affiliate && hasAffiliateMonth(affiliate, month)) {
    pages.push({
      title: "Affiliate · YouTube Shopping",
      body: (
        <div className="mr-live">
          <FitBox>
            <div className="mr-live-page">
              <AffiliateMonthPage data={affiliate} month={month} />
            </div>
          </FitBox>
          <p className="mr-live-note">จาก Google Sheet ที่นำเข้าใน Affiliate Program Report · ค่าคอมรายเดือน = Earned revenue · รายสินค้า = Estimated revenue</p>
        </div>
      ),
    });
  }
  // YouTube Revenue, after Affiliate: the same rule (who may see revenue, a month with numbers).
  if (revenue && hasRevenueMonth(revenue.months, month)) {
    pages.push({
      title: "YouTube Revenue",
      body: (
        <div className="mr-live">
          <FitBox>
            <div className="mr-live-page">
              <RevenueMonthPage data={revenue.data} months={revenue.months} month={month} />
            </div>
          </FitBox>
          <p className="mr-live-note">จากไฟล์ Revenue ที่นำเข้าใน YouTube Revenue Report · เดือนที่ยังไม่มีไฟล์ใช้ยอดจาก YouTube CMS API (ประมาณการ) · USD</p>
        </div>
      ),
    });
  }
  return pages;
}
