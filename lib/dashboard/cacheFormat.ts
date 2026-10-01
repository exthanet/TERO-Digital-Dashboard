// Compact copy of masterData for opening the dashboard fast (dashboardCache/*).
// masterData stays the one source of truth; this copy keeps only what the
// dashboard reads, is gzipped, and carries the masterData version it was made
// from. A copy whose version does not match is never used.
//
// Shared by the browser (lib/dashboardCache.ts) and the sync script
// (lib/integrations/dashboardCacheWriter.ts), so both build the same thing.
import type { RawRow } from "@/lib/dashboard/types";

/** Every column lib/dashboard/normalize.ts reads, including the alternative names it accepts. */
export const DASHBOARD_COLUMNS = [
  "Date", "date", "Publish Date",
  "Program", "รายการ", "program",
  "Episode_ID", "Episode ID",
  "Topic", "ประเด็น", "Video title",
  "Topic_Type", "Topic Type", "ประเภทเนื้อหา",
  "VDO_Type", "VDO Type", "video type",
  "Platform", "platform",
  "Channel", "channel", "Page Name", "page-name",
  "Province", "จังหวัด", "province",
  "Content_ID", "Content", "Video ID",
  "URL", "Url",
  "Duration_Min", "Duration Min",
  "Views", "views", "View",
  "Likes", "likes", "Like",
  "Comments", "comments",
  "Shares", "shares", "Share",
  "Engagement", "engagement",
  "Engagement_Rate", "Engagement Rate", "engagement_rate",
  "TV_Rating_Total", "Rating Total",
  "TV_Rating_15+BKK", "TV_Rating_15+URBAN", "TV_Rating_15+BKK&URBAN", "TV_Rating_15+RURAL",
  "TV_Audience_Total",
  "Best_of_Month", "Best of Month",
  "Upload_Count",
  "Revenue", "Estimated revenue (THB)",
] as const;

const KEEP = new Set<string>(DASHBOARD_COLUMNS);

/** Firestore documents hold at most 1 MiB; parts stay well under it. */
export const CACHE_PART_BYTES = 900_000;

const isTvRow = (r: RawRow) => {
  const p = String(r.Platform ?? r.platform ?? "");
  const ch = String(r.Channel ?? r.channel ?? "").toLowerCase();
  return p === "TV" || (!p && (ch.includes("one") || ch.includes("gmm"))) || Number(r.TV_Rating_Total) > 0;
};

/**
 * Rows as the dashboard needs them. TV rows are kept whole (a few hundred rows;
 * Notes carries legacy GMM figures and the TV upload preview needs every TV
 * column); other rows keep only the columns the dashboard reads, without blanks.
 */
export function slimRows(rows: RawRow[]): RawRow[] {
  return rows.map((r) => {
    if (isTvRow(r)) return r;
    const out: RawRow = {};
    for (const [k, v] of Object.entries(r)) {
      if (KEEP.has(k) && v !== null && v !== undefined && v !== "") out[k] = v;
    }
    return out;
  });
}

/** Split gzipped bytes into document-sized parts, and join them back. */
export function splitBytes(bytes: Uint8Array, size = CACHE_PART_BYTES): Uint8Array[] {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.subarray(i, i + size));
  return parts.length ? parts : [new Uint8Array(0)];
}

export function joinBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export const partId = (i: number) => `part_${String(i).padStart(2, "0")}`;
