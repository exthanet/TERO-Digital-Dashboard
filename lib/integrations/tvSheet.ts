// TV ratings from the team's rating workbook (one tab per program + channel,
// e.g. "ถกไม่เถียงONE-คู่แข่ง"), merged into masterData by the daily sync.
//
// Ownership: the workbook owns the TV_Rating_* and TV_Audience_* numbers of
// each episode. Everything else on existing rows (topic, labels, notes) stays
// as the team wrote it; new episodes are added with the workbook's topic.
// Audience is not in the workbook: rating × 700,000 people per rating point,
// except One31's total, which uses the "Viewership (15+)" column when filled
// (the same rules the existing data follows).
import { sourceDay } from "../dashboard/normalize.ts";

type Row = Record<string, unknown>;

export type TvChannel = "One31" | "GMM25";

export interface TvSource {
  id: string;
  name: string;
  /** SharePoint / OneDrive sharing link of the workbook. */
  url: string;
  /** Tab to read. */
  sheet: string;
  channel: TvChannel;
  program: string;
  enabled: boolean;
}

export interface TvEpisode {
  date: string;
  program: string;
  channel: TvChannel;
  topic: string;
  topicType: string;
  durationMin: number;
  rating: number;
  bkk: number;
  urban: number;
  bkkUrban: number;
  rural: number;
  /** One31 "Viewership (15+)"; 0 when blank. */
  viewers: number;
  /** Set when the name came from the day's clips (a tab without episode names). */
  episodeId?: string;
  notes?: string;
  named?: boolean;
}

export interface TvCompetitor {
  date: string;
  /** "ช่อง 3" for the channel-pair columns, "" for time-slot columns. */
  competitorChannel: string;
  program: string;
  /** Time slot from the column header, e.g. "12.35 - 13.30 น.". */
  slot: string;
  rating: number;
}

export const AUDIENCE_PER_POINT = 700_000;
export const RATING_COLUMNS = ["TV_Rating_Total", "TV_Rating_15+BKK", "TV_Rating_15+URBAN", "TV_Rating_15+BKK&URBAN", "TV_Rating_15+RURAL"] as const;
export const AUDIENCE_COLUMNS = ["TV_Audience_Total", "TV_Audience_15+BKK", "TV_Audience_15+URBAN", "TV_Audience_15+BKK&URBAN", "TV_Audience_15+RURAL"] as const;
export const TV_OWNED = new Set<string>([...RATING_COLUMNS, ...AUDIENCE_COLUMNS]);

const TH_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
};

/** "จันทร์ 5 ม.ค. 2026" / "5 ม.ค. 69" / Excel serial / 05/01/2026 → "2026-01-05". */
export function thaiDay(v: unknown): string {
  const plain = sourceDay(v);
  if (plain) return plain;
  const m = String(v ?? "").match(/(\d{1,2})\s*([ก-๙]+\.?[ก-๙]*\.?)\s*(\d{2,4})/);
  if (!m) return "";
  const month = TH_MONTHS[m[2].replace(/\s/g, "")];
  if (!month) return "";
  let year = Number(m[3]);
  if (year < 100) year += year > 50 ? 2500 : 2000; // "69" = 2569
  if (year > 2400) year -= 543;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Numbers as written in the sheet; "" / text → NaN so blanks stay blank. */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  if (!t) return NaN;
  const m = t.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

const clean = (h: unknown) => String(h ?? "").replace(/\s+/g, "");

/** "โหนกระแส\n12.35 - 13.30 น." → name + slot. */
function splitSlot(header: unknown) {
  const text = String(header ?? "").replace(/\r/g, "").trim();
  const m = text.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}\s*น?\.?)/);
  return { name: text.split("\n")[0].trim(), slot: m ? m[1].replace(/\s+/g, " ") : "" };
}

export interface ParsedTvSheet {
  episodes: TvEpisode[];
  competitors: TvCompetitor[];
  /** Episode rows whose rating is not in yet (filled on a later sync). */
  pending: string[];
  /** "งด": no broadcast that day. */
  cancelled: string[];
  skippedRows: number;
  missingColumns: string[];
  /** Rows read with a correction, or left out, for a person to check (Excel row numbers). */
  problems?: string[];
}

/**
 * Read one tab (rows as arrays, header first). Columns are found by their
 * header text, so the team may reorder or add columns. A Nielsen export
 * ("Date", "15+NW", no episode names) is read by parseNielsenSheet.
 */
export function parseTvSheet(aoa: unknown[][], source: Pick<TvSource, "channel" | "program">): ParsedTvSheet {
  const nielsen = aoa.slice(0, 10).findIndex((r) => (r || []).map(clean).includes("Date") && (r || []).map(clean).includes("15+NW"));
  if (!(aoa[0] || []).map(clean).includes("วันที่") && nielsen >= 0) return parseNielsenSheet(aoa, nielsen, source);
  const header = (aoa[0] || []).map(clean);
  const find = (...names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h === clean(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const starts = (prefix: string) => header.findIndex((h) => h.startsWith(clean(prefix)));
  const col = {
    date: find("วันที่"),
    type: find("ประเภทเนื้อหา"),
    air: starts("เวลาออกอากาศ"),
    topic: find("ประเด็น"),
    rating: source.channel === "One31" ? find("เรตติง ONE", "เรตติงONE31", "เรตติง") : find("เรตติง GMM25", "เรตติง"),
    bkk: find("15+BKK"),
    urban: find("15+URBAN"),
    bkkUrban: find("15+BKK&URBAN"),
    rural: find("15+RURAL"),
    viewers: starts("Viewership"),
  };
  const required = ["date", "topic", "rating", "bkk", "urban", "bkkUrban", "rural"] as const;
  const missingColumns = required.filter((k) => col[k] < 0);
  const out: ParsedTvSheet = { episodes: [], competitors: [], pending: [], cancelled: [], skippedRows: 0, missingColumns };
  if (missingColumns.length) return out;

  // Competitors: "เรทติงคู่แข่งช่อง 3" (program name) followed by its "เรตติง" column,
  // and time-slot columns ("โหนกระแส 12.35 - 13.30 น.") holding a rating.
  const pairCols = header
    .map((h, i) => (h.startsWith("เรทติงคู่แข่ง") ? { i, channel: String(aoa[0][i]).replace(/^เรทติงคู่แข่ง/, "").trim() } : null))
    .filter((x): x is { i: number; channel: string } => !!x);
  const ownProgram = clean(source.program);
  const slotCols = (aoa[0] || [])
    .map((h, i) => ({ i, ...splitSlot(h) }))
    .filter((c) => c.slot && !clean(c.name).startsWith(ownProgram));

  for (const r of aoa.slice(1)) {
    const date = thaiDay(r[col.date]);
    if (!date) {
      out.skippedRows++; // monthly averages, notes, blank rows
      continue;
    }
    const rating = num(r[col.rating]);
    // Only the episode name, no rating yet (blank, text or 0): not imported, counted as waiting.
    if (!Number.isFinite(rating) || rating <= 0) {
      if (String(r[col.rating] ?? "").includes("งด")) out.cancelled.push(date);
      else out.pending.push(date);
      continue;
    }
    const minutes = num(col.air >= 0 ? r[col.air] : "");
    out.episodes.push({
      date,
      program: source.program,
      channel: source.channel,
      topic: String(r[col.topic] ?? "").trim(),
      topicType: col.type >= 0 ? String(r[col.type] ?? "").trim() : "",
      durationMin: Number.isFinite(minutes) ? minutes : 0,
      rating,
      bkk: num(r[col.bkk]) || 0,
      urban: num(r[col.urban]) || 0,
      bkkUrban: num(r[col.bkkUrban]) || 0,
      rural: num(r[col.rural]) || 0,
      viewers: col.viewers >= 0 ? num(r[col.viewers]) || 0 : 0,
    });
    for (const p of pairCols) {
      const name = String(r[p.i] ?? "").trim();
      const value = num(r[p.i + 1]);
      if (name && Number.isFinite(value)) out.competitors.push({ date, competitorChannel: p.channel, program: name, slot: "", rating: value });
    }
    for (const s of slotCols) {
      const value = num(r[s.i]);
      if (Number.isFinite(value)) out.competitors.push({ date, competitorChannel: "", program: s.name, slot: s.slot, rating: value });
    }
  }
  return out;
}

const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * One date cell of a Nielsen export, checked against its "Day of week": an Excel day
 * number, "05/01/2026" or "9/3/69" (Buddhist year). A year typed wrong ("11/02/2027"
 * next to 2026 rows) is read with the year of the rows before it when the weekday then
 * matches. Anything else is left out rather than guessed.
 */
export function nielsenDay(v: unknown, dow: unknown, prevYear = 0): { date: string; fixed?: string; problem?: string } {
  const want = WEEKDAYS[String(dow ?? "").trim().slice(0, 3).toLowerCase()];
  const weekdayOk = (d: string) => !!d && (want === undefined || new Date(`${d}T00:00:00Z`).getUTCDay() === want);
  const day = (y: number, m: number, d: number) => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : "";
  };
  if (typeof v === "number") {
    const d = sourceDay(v);
    return weekdayOk(d) ? { date: d } : { date: "", problem: `วันที่ ${d || v} ไม่ตรงกับวัน ${dow}` };
  }
  const text = String(v ?? "").trim();
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return { date: "", problem: text ? `อ่านวันที่ "${text}" ไม่ได้` : "" };
  let year = Number(m[3]);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  const d = day(year, Number(m[2]), Number(m[1]));
  if (weekdayOk(d)) return { date: d };
  if (prevYear && prevYear !== year) {
    const again = day(prevYear, Number(m[2]), Number(m[1]));
    if (weekdayOk(again)) return { date: again, fixed: `"${text}" ปีพิมพ์ผิด อ่านเป็น ${again}` };
  }
  return { date: "", problem: `"${text}" ไม่ตรงกับวัน ${dow}` };
}

/**
 * A Nielsen export tab: header row with "Date", "Day of week", "Duration", "15+NW"
 * (the total rating), the four areas and "Viewership (15+)"; no episode names (the sync
 * names the episodes from the day's clips). Rows below the table (summaries) have no date.
 * A day that appears twice keeps its first row.
 */
export function parseNielsenSheet(aoa: unknown[][], headerRow: number, source: Pick<TvSource, "channel" | "program">): ParsedTvSheet {
  const header = (aoa[headerRow] || []).map(clean);
  const find = (name: string) => header.indexOf(clean(name));
  const col = {
    date: find("Date"),
    dow: find("Day of week"),
    duration: find("Duration"),
    rating: find("15+NW"),
    bkk: find("15+BKK"),
    urban: find("15+URBAN"),
    bkkUrban: find("15+BKK&URBAN"),
    rural: find("15+RURAL"),
    viewers: header.findIndex((h) => h.startsWith("Viewership")),
  };
  const required = ["date", "rating", "bkk", "urban", "bkkUrban", "rural"] as const;
  const missingColumns = required.filter((k) => col[k] < 0).map((k) => k);
  const out: ParsedTvSheet = { episodes: [], competitors: [], pending: [], cancelled: [], skippedRows: 0, missingColumns, problems: [] };
  if (missingColumns.length) return out;
  const seen = new Map<string, number>();
  let prevYear = 0;
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const excelRow = i + 1;
    const parsed = nielsenDay(r[col.date], col.dow >= 0 ? r[col.dow] : "", prevYear);
    if (!parsed.date) {
      out.skippedRows++;
      // A row with a rating but no usable date is a lost episode: say so.
      if (parsed.problem && Number.isFinite(num(r[col.rating]))) out.problems!.push(`แถว ${excelRow}: ${parsed.problem} (ไม่ได้นำเข้า)`);
      continue;
    }
    const date = parsed.date;
    prevYear = Number(date.slice(0, 4));
    if (parsed.fixed) out.problems!.push(`แถว ${excelRow}: ${parsed.fixed}`);
    if (seen.has(date)) {
      out.problems!.push(`แถว ${excelRow}: วันที่ ${date} ซ้ำกับแถว ${seen.get(date)} (ใช้แถว ${seen.get(date)})`);
      continue;
    }
    seen.set(date, excelRow);
    const rating = num(r[col.rating]);
    if (!Number.isFinite(rating) || rating <= 0) {
      if (String(r[col.rating] ?? "").includes("งด")) out.cancelled.push(date);
      else out.pending.push(date);
      continue;
    }
    // Duration is an Excel time (a fraction of a day) or minutes.
    const d = num(col.duration >= 0 ? r[col.duration] : "");
    const minutes = Number.isFinite(d) ? (d < 1 ? d * 1440 : d) : 0;
    out.episodes.push({
      date,
      program: source.program,
      channel: source.channel,
      topic: "",
      topicType: "",
      durationMin: Math.round(minutes * 10) / 10,
      rating,
      bkk: num(r[col.bkk]) || 0,
      urban: num(r[col.urban]) || 0,
      bkkUrban: num(r[col.bkkUrban]) || 0,
      rural: num(r[col.rural]) || 0,
      viewers: col.viewers >= 0 ? num(r[col.viewers]) || 0 : 0,
    });
  }
  return out;
}

const round = (n: number) => Math.round(n);

/** The owned numbers of one episode, as masterData stores them. */
export function episodeNumbers(e: TvEpisode): Record<string, number> {
  const total = e.channel === "One31" && e.viewers > 0 ? round(e.viewers) : round(e.rating * AUDIENCE_PER_POINT);
  return {
    TV_Rating_Total: e.rating,
    "TV_Rating_15+BKK": e.bkk,
    "TV_Rating_15+URBAN": e.urban,
    "TV_Rating_15+BKK&URBAN": e.bkkUrban,
    "TV_Rating_15+RURAL": e.rural,
    TV_Audience_Total: total,
    "TV_Audience_15+BKK": round(e.bkk * AUDIENCE_PER_POINT),
    "TV_Audience_15+URBAN": round(e.urban * AUDIENCE_PER_POINT),
    "TV_Audience_15+BKK&URBAN": round(e.bkkUrban * AUDIENCE_PER_POINT),
    "TV_Audience_15+RURAL": round(e.rural * AUDIENCE_PER_POINT),
  };
}

/** "ONE31", "One31", "GMM 25" → one spelling per channel. */
export function tvChannel(v: unknown): TvChannel | "" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("gmm")) return "GMM25";
  if (s.includes("one")) return "One31";
  return "";
}

export const isTvRow = (r: Row) => r.Platform === "TV";
export const tvKey = (date: unknown, program: unknown, channel: unknown) => `${date}|${program}|${tvChannel(channel)}`;

const numEq = (a: unknown, b: unknown) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-9;
const blank = (v: unknown) => v === undefined || v === null || v === "" || v === "-";

export interface TvChange {
  key: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface TvMergeResult {
  rows: Row[];
  updated: TvChange[];
  inserted: Row[];
  /** Older copies of the same episode ("ONE31" next to "One31") with identical numbers. */
  removed: { key: string; row: Row }[];
  /** Copies whose ratings differ: left untouched for a person to check. */
  conflicts: string[];
  /** Episodes named from the day's clips whose blank name / EP / note were filled (key → columns). */
  named: { key: string; columns: string[] }[];
  /** Copies with the same ratings but different audience numbers (fixed from the rating). */
  audienceFixed: string[];
  unchanged: number;
}

/**
 * Apply workbook episodes to masterData rows. Digital rows are never touched.
 * Several rows for one episode (legacy "ONE31" + "One31") collapse into one
 * when their ratings are identical; otherwise they are all left as they are.
 */
export function mergeTvEpisodes(rows: Row[], episodes: TvEpisode[]): TvMergeResult {
  const out: TvMergeResult = { rows: [], updated: [], inserted: [], removed: [], conflicts: [], audienceFixed: [], named: [], unchanged: 0 };
  const byKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (!isTvRow(r)) return;
    const k = tvKey(r.Date, r.Program, r.Channel);
    byKey.set(k, [...(byKey.get(k) || []), i]);
  });
  const drop = new Set<number>();
  const replaced = new Map<number, Row>();
  const columns = rows.find(isTvRow) ? Object.keys(rows.find(isTvRow) as Row) : [];

  for (const e of episodes) {
    const k = tvKey(e.date, e.program, e.channel);
    const numbers = episodeNumbers(e);
    const idx = byKey.get(k) || [];
    if (!idx.length) {
      const row: Row = Object.fromEntries(columns.map((c) => [c, null]));
      Object.assign(row, {
        Date: e.date, Program: e.program, Episode_ID: e.episodeId || null, Topic: e.topic, Topic_Type: e.topicType,
        VDO_Type: "TV", Platform: "TV", Channel: e.channel, Content_ID: `TV-${e.channel}-${e.date}`, URL: "-",
        Publish_Time: null, Duration_Min: e.durationMin, Views: 0, Likes: 0, Comments: 0, Shares: 0,
        Engagement: 0, Engagement_Rate: 0, Best_of_Month: null, Upload_Count: 1, Revenue: 0,
        Notes: e.notes || `TV rating workbook (${e.channel})`, ...numbers,
      });
      out.inserted.push(row);
      continue;
    }
    // Several rows for one episode collapse when their ratings agree; audience
    // is derived from the rating, so a differing copy is simply corrected.
    const keep = idx.find((i) => rows[i].Channel === e.channel) ?? idx[0];
    if (idx.length > 1) {
      const sameRatings = idx.every((i) => RATING_COLUMNS.every((c) => numEq(rows[i][c], rows[keep][c])));
      if (!sameRatings) {
        out.conflicts.push(`${k}: ${idx.length} แถว rating ไม่ตรงกัน (ไม่ได้แก้)`);
        continue;
      }
      if (!idx.every((i) => AUDIENCE_COLUMNS.every((c) => numEq(rows[i][c], rows[keep][c])))) {
        out.audienceFixed.push(`${k}: ${idx.length} แถว audience ไม่ตรงกัน → คำนวณใหม่จาก rating`);
      }
    }
    const base: Row = { ...rows[keep] };
    for (const i of idx) {
      if (i === keep) continue;
      for (const [c, v] of Object.entries(rows[i])) if (blank(base[c]) && !blank(v)) base[c] = v;
      out.removed.push({ key: k, row: rows[i] });
      drop.add(i);
    }
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [c, v] of Object.entries(numbers)) {
      if (!numEq(base[c], v) || blank(base[c])) {
        before[c] = base[c];
        after[c] = v;
        base[c] = v;
      }
    }
    // A tab without names: the day's clips name the episode once they exist. Only blanks
    // are filled (and the system's own note refreshed); a name the team typed stays.
    if (e.named) {
      const filled: string[] = [];
      const fill = (c: string, v: unknown, when: boolean) => {
        if (!when || v === undefined || v === "" || JSON.stringify(base[c]) === JSON.stringify(v)) return;
        before[c] = base[c];
        after[c] = v;
        base[c] = v;
        filled.push(c);
      };
      fill("Topic", e.topic, blank(base.Topic));
      fill("Topic_Type", e.topicType, blank(base.Topic_Type));
      fill("Episode_ID", e.episodeId || undefined, blank(base.Episode_ID));
      fill("Notes", e.notes, blank(base.Notes) || String(base.Notes).startsWith("TV rating workbook"));
      if (filled.length) out.named.push({ key: k, columns: filled });
    }
    if (base.Channel !== e.channel) {
      before.Channel = base.Channel;
      after.Channel = e.channel;
      base.Channel = e.channel;
    }
    if (Object.keys(after).length || idx.length > 1) {
      replaced.set(keep, base);
      if (Object.keys(after).length) out.updated.push({ key: k, before, after });
      else out.unchanged++;
    } else out.unchanged++;
  }
  rows.forEach((r, i) => {
    if (drop.has(i)) return;
    out.rows.push(replaced.get(i) || r);
  });
  out.rows.push(...out.inserted);
  return out;
}
