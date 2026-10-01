import type { ComparePreset, DatePreset } from "@/lib/dashboard/types";

export const isoDate = (value: Date) => value.toISOString().slice(0, 10);

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
};

/** Today's date in Bangkok as "YYYY-MM-DD". */
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1–12
const pad = (n: number) => String(n).padStart(2, "0");
const min = (a: string, b: string) => (a < b ? a : b);

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/**
 * Date range of a preset. Rolling ranges and the current year/month/quarter
 * end yesterday: today is not over and the morning sync only has part of it.
 * `data` is the first/last day in the data, for "ทั้งหมด".
 */
export function getDatePresetRange(preset: DatePreset, data?: { first: string; last: string }, now = new Date()): [string, string] {
  const yesterday = shift(bangkokToday(now), -1);
  const rolling = preset.match(/^LAST_(\d+)_DAYS$/);
  if (rolling) return [shift(yesterday, -(Number(rolling[1]) - 1)), yesterday];
  if (preset === "ALL") return [data?.first || "", data?.last || ""];
  const year = preset.match(/^YEAR_(\d{4})$/);
  if (year) return [`${year[1]}-01-01`, min(`${year[1]}-12-31`, yesterday)];
  const month = preset.match(/^MONTH_(\d{4})-(\d{2})$/);
  if (month) {
    const [y, m] = [Number(month[1]), Number(month[2])];
    return [`${y}-${pad(m)}-01`, min(`${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`, yesterday)];
  }
  const quarter = preset.match(/^QUARTER_(\d{4})_([1-4])$/);
  if (quarter) {
    const y = Number(quarter[1]);
    const first = (Number(quarter[2]) - 1) * 3 + 1;
    return [`${y}-${pad(first)}-01`, min(`${y}-${pad(first + 2)}-${pad(lastDayOfMonth(y, first + 2))}`, yesterday)];
  }
  return ["", ""];
}

export interface PresetGroup {
  label: string;
  options: { value: DatePreset; label: string }[];
}

/** The date menu: recent ranges, years and months with data, this year's quarters, custom. */
export function datePresetGroups(firstDataDate: string, now = new Date()): PresetGroup[] {
  const yesterday = shift(bangkokToday(now), -1);
  const [yy, ym] = [Number(yesterday.slice(0, 4)), Number(yesterday.slice(5, 7))];
  const firstYear = Number((firstDataDate || yesterday).slice(0, 4));
  const years: PresetGroup["options"] = [];
  for (let y = yy; y >= firstYear; y--) years.push({ value: `YEAR_${y}`, label: `ปี ${y + 543}` });
  const months: PresetGroup["options"] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(yy, ym - 1 - i, 1));
    const [y, m] = [d.getUTCFullYear(), d.getUTCMonth() + 1];
    if (firstDataDate && `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}` < firstDataDate) break;
    months.push({ value: `MONTH_${y}-${pad(m)}`, label: `${TH_MONTH[m - 1]} ${y + 543}${i === 0 && Number(yesterday.slice(8)) < lastDayOfMonth(y, m) ? " (ถึงเมื่อวาน)" : ""}` });
  }
  const quarters: PresetGroup["options"] = [];
  for (let q = Math.ceil(ym / 3); q >= 1; q--) {
    const first = (q - 1) * 3;
    quarters.push({ value: `QUARTER_${yy}_${q}` as DatePreset, label: `ไตรมาส ${q}/${yy + 543} (${TH_MONTH[first]}–${TH_MONTH[first + 2]})` });
  }
  return [
    {
      label: "ช่วงล่าสุด (ถึงเมื่อวาน)",
      options: [
        { value: "LAST_7_DAYS", label: "7 วันล่าสุด" },
        { value: "LAST_28_DAYS", label: "28 วันล่าสุด" },
        { value: "LAST_90_DAYS", label: "90 วันล่าสุด" },
        { value: "LAST_365_DAYS", label: "365 วันล่าสุด" },
        { value: "ALL", label: "ทั้งหมด" },
      ],
    },
    { label: "รายปี", options: years },
    { label: "รายเดือน", options: months },
    { label: "รายไตรมาส", options: quarters },
    { label: "อื่นๆ", options: [{ value: "CUSTOM", label: "กำหนดเอง" }] },
  ];
}

/** Same day one year earlier; 29 Feb becomes 28 Feb. */
export function shiftYear(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ty = y + years;
  return `${ty}-${pad(m)}-${pad(Math.min(d, lastDayOfMonth(ty, m)))}`;
}

/** The range the KPI % compares with, or null when not comparing. */
export function getCompareRange(
  start: string,
  end: string,
  mode: ComparePreset,
  custom?: { start: string; end: string },
): { start: string; end: string } | null {
  if (!start || !end || end < start || mode === "NONE") return null;
  if (mode === "YEAR_AGO") return { start: shiftYear(start, -1), end: shiftYear(end, -1) };
  if (mode === "CUSTOM") return custom?.start && custom.end && custom.end >= custom.start ? { start: custom.start, end: custom.end } : null;
  // PREVIOUS: the period of the same length right before.
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  const prevEnd = shift(start, -1);
  return { start: shift(prevEnd, -(days - 1)), end: prevEnd };
}

export const COMPARE_OPTIONS: { value: ComparePreset; label: string }[] = [
  { value: "PREVIOUS", label: "ช่วงก่อนหน้า" },
  { value: "YEAR_AGO", label: "ช่วงเดียวกันปีที่แล้ว" },
  { value: "CUSTOM", label: "กำหนดช่วงเอง" },
  { value: "NONE", label: "ไม่เปรียบเทียบ" },
];
