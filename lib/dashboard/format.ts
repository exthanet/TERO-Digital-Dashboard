export const compact = (v: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v || 0);

export const num = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v || 0);

export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export const dateLabel = (d: string) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
      })
    : "-";

export const dateTimeLabel = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
