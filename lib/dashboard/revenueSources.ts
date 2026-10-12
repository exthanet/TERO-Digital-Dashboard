// ACC report → "Revenue source" block of the monthly YouTube earnings workbook:
// YouTube Studio's "Revenue source" exports (one zip per channel), matched to the
// workbook's channel rows. Raw numbers from the files; this file only parses and
// matches. Used by scripts/acc-revenue-sources.mjs.
//
// Relative imports only: tests run this file directly with Node.

/** The workbook's columns F–O, in order (row 52 of the sheet). */
export const SOURCE_COLUMNS = [
  "Estimated partner ad revenue",
  "YouTube Premium",
  "Shopping Star Bonus",
  "Affiliate program",
  "Shorts Feed ads",
  "Memberships",
  "Super Chat",
  "Super Stickers",
  "Super Thanks",
  "YouTube Player for Education",
] as const;

export interface ZipName {
  start: string;
  end: string;
  channel: string;
}

/** "Revenue source 2026-09-01_2026-10-01 HITZ Thailand.zip" → period and channel; null for other files. */
export function parseZipName(file: string): ZipName | null {
  const m = file.match(/^Revenue source (\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2}) (.+)\.zip$/i);
  // A download made twice ends in " (1)": not part of the channel name.
  return m ? { start: m[1], end: m[2], channel: m[3].replace(/\s*\(\d+\)$/, "").trim() } : null;
}

/** One CSV line, quotes allowed ("a, b",1.5). */
export function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** "Table data.csv" of a Revenue source export → { source: USD }, "Total" included. */
export function parseSourceTable(text: string): Record<string, number> {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const out: Record<string, number> = {};
  for (const line of lines.slice(1)) {
    const [name, value] = csvLine(line);
    const n = Number(value);
    if (name && Number.isFinite(n)) out[name.trim()] = n;
  }
  return out;
}

/** "Table data.csv" of the CMS Channel export → channel title → channel ID. */
export function parseCmsChannels(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/).slice(1)) {
    const [id, title] = csvLine(line);
    if (id && title && id !== "Total") m.set(title.trim(), id.trim());
  }
  return m;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, "");

export interface SheetRow {
  row: number;
  name: string;
  /** The workbook keeps channel IDs without their first letters ("NcZ9a…" for "UCNcZ9a…"). */
  id: string;
}

/**
 * The sheet row for a channel: by channel ID when the CMS export knows the title
 * (the zip's " _ " is the title's " | "), else by name. null = not matched (never guessed).
 */
export function matchRow(channel: string, rows: SheetRow[], cms: Map<string, string>): { row: SheetRow; by: "id" | "name" } | null {
  const id = cms.get(channel) || cms.get(channel.replace(/ _ /g, " | "));
  if (id) {
    const byId = rows.find((r) => r.id.length >= 10 && id.endsWith(r.id));
    if (byId) return { row: byId, by: "id" };
  }
  const n = norm(channel);
  const byName = rows.filter((r) => norm(r.name) === n);
  return byName.length === 1 ? { row: byName[0], by: "name" } : null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026", "08" → sheet name "Report_August_2026" and header "Aug 1-31, 2026" (the month's real last day). */
export function monthLabels(year: string, month: string): { sheet: string; header: string } {
  const m = Number(month);
  const last = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
  const name = MONTHS[m - 1];
  return { sheet: `Report_${name}_${year}`, header: `${name.slice(0, 3)} 1-${last}, ${year}` };
}

/** The dashboard's Monthly ACC export columns → the workbook's columns C–L (rows 7–30). */
export const EXPORT_COLUMNS = [
  "YouTube Premium views",
  "Owned Views",
  "Owned Views : Watch Page",
  "Owned Views : Embedded Player",
  "Owned Views : Channel Page",
  "Owned Views : Live",
  "Owned Views : On Demand",
  "Owned Views : Ad-Enabled",
  "Ads Partner Revenue (USD)",
  "YouTube Premium partner revenue (USD)",
] as const;
