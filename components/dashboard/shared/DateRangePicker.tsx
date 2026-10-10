"use client";
// The date label of the filter bar as a button: opens a calendar to pick a
// range (click the first day, then the last). Thai month names, Buddhist years
// like the label; days outside the data (before the first day, after yesterday) are off.
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { th } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "YYYY-MM-DD" ↔ a local-midnight Date (the calendar works in local days). */
const toDate = (iso: string) => (iso ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : undefined);
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayCount = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

/** Longest range the growth page can load (lib/dashboard/growth.ts GROWTH_MAX_DAYS). */
const GROWTH_DAYS = 92;

export function DateRangePicker({
  start,
  end,
  min,
  max,
  label,
  onPick,
}: {
  start: string;
  end: string;
  /** First selectable day ("" = no limit). */
  min: string;
  /** Last selectable day (yesterday: today is synced tomorrow morning). */
  max: string;
  label: string;
  /** A full range was picked (start ≤ end). */
  onPick: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // First click of a new pick; null = showing the current range.
  const [first, setFirst] = useState<Date | null>(null);
  const [months, setMonths] = useState(2);

  // Two months side by side, one on phones (same breakpoint as styles/mobile.css).
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 800px)");
    const apply = () => setMonths(mql.matches ? 1 : 2);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const selected: DateRange | undefined = first ? { from: first, to: undefined } : start && end ? { from: toDate(start), to: toDate(end) } : undefined;
  const endDate = toDate(end);
  // Open on the month before the end, so the end month is on the right.
  const defaultMonth = endDate ? new Date(endDate.getFullYear(), endDate.getMonth() - (months - 1), 1) : undefined;
  const days = start && end ? dayCount(start, end) : 0;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setFirst(null);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="date-range-text date-range-btn" title="คลิกเพื่อเลือกช่วงวันที่เองจากปฏิทิน">
          <span>{label}</span>
          <CalendarDays size={14} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="date-range-pop" align="start">
        <Calendar
          mode="range"
          locale={th}
          numberOfMonths={months}
          defaultMonth={defaultMonth}
          selected={selected}
          disabled={[...(min ? [{ before: toDate(min)! }] : []), ...(max ? [{ after: toDate(max)! }] : [])]}
          startMonth={min ? toDate(min) : undefined}
          endMonth={max ? toDate(max) : undefined}
          formatters={{ formatCaption: (d) => `${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}` }}
          onSelect={(_range, day) => {
            if (!first) {
              setFirst(day);
              return;
            }
            const [a, b] = first <= day ? [first, day] : [day, first];
            setFirst(null);
            setOpen(false);
            onPick(toIso(a), toIso(b));
          }}
        />
        <p className="date-range-hint">
          {first
            ? "เลือกวันสุดท้ายของช่วง"
            : `คลิกวันแรก แล้วคลิกวันสุดท้าย · ตอนนี้ ${days} วัน${days > GROWTH_DAYS ? ` (หน้าการเติบโตแสดงได้ไม่เกิน ${GROWTH_DAYS} วัน)` : ""}`}
        </p>
      </PopoverContent>
    </Popover>
  );
}
