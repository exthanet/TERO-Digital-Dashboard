import type { DatePreset } from "@/lib/dashboard/types";

export const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function getDatePresetRange(preset: DatePreset, referenceYear?: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
  const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const year = parts.year,
    month = parts.month - 1;
  if (preset === "TODAY") return [isoDate(today), isoDate(today)];
  if (preset === "LAST_7_DAYS") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    return [isoDate(start), isoDate(today)];
  }
  if (preset === "THIS_MONTH")
    return [isoDate(new Date(Date.UTC(year, month, 1))), isoDate(today)];
  if (preset === "LAST_MONTH")
    return [
      isoDate(new Date(Date.UTC(year, month - 1, 1))),
      isoDate(new Date(Date.UTC(year, month, 0))),
    ];
  if (preset === "THIS_YEAR") return [`${year}-01-01`, isoDate(today)];
  if (preset === "LAST_YEAR") return [`${year - 1}-01-01`, `${year - 1}-12-31`];
  const q = preset.match(/^QUARTER_([1-4])$/);
  if (q) {
    const targetYear = referenceYear || year,
      startMonth = (Number(q[1]) - 1) * 3 + 1,
      endMonth = startMonth + 2,
      lastDay = new Date(Date.UTC(targetYear, endMonth, 0)).getUTCDate();
    return [
      `${targetYear}-${String(startMonth).padStart(2, "0")}-01`,
      `${targetYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    ];
  }
  return ["", ""];
}
