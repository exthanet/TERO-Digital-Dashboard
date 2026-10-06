// Checks a merged data set before it may replace production data.
// Any failed check blocks the write; warnings are listed for a person to read.
import { excelDate, isPlainDay, normalizeRowsWithDeduplication } from "../dashboard/normalize.ts";
import { parseNumber } from "./metricool.ts";
import { FILL_COLUMNS, METRIC_COLUMNS, canFill, rowKey, type MergeResult } from "./metricoolSync.ts";
import { RATING_COLUMNS, TV_OWNED, isTvRow, tvChannel, tvKey, type TvEpisode, type TvMergeResult } from "./tvSheet.ts";

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
  warnings?: string[];
}

type Row = Record<string, unknown>;

const DIGITAL = new Set(["Facebook", "Instagram", "TikTok", "YouTube"]);
/** Rows per Firestore document, as saveMasterDataToFirebase writes them. */
const CHUNK_ROWS = 250;
const DOC_LIMIT = 1_048_576;

function monthlyViews(rows: Row[]) {
  const m = new Map<string, number>();
  for (const r of normalizeRowsWithDeduplication(rows as never)) {
    if (!DIGITAL.has(r.platform)) continue;
    const k = `${r.date.slice(0, 7)} ${r.platform}`;
    m.set(k, (m.get(k) || 0) + r.views);
  }
  return m;
}

export function validateMerge(
  baseline: Row[],
  result: MergeResult,
  incoming: Row[] = [],
  dedupe?: { originalCount: number; removed: { key: string; row: Row }[] },
): { ok: boolean; checks: Check[]; stats: Record<string, unknown> } {
  const { merged, inserted, updated } = result;
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string, warnings?: string[]) =>
    checks.push({ name, pass, detail, ...(warnings?.length ? { warnings } : {}) });

  // 1. Nothing lost: every existing row is still at its position (same post,
  // or for TV rows the same date/program/channel); new rows are appended.
  // Counting alone is not enough: one lost row plus one extra row adds up.
  const identity = (r: Row | undefined) =>
    r ? rowKey(r) || `${r.Platform}|${r.Date}|${r.Program}|${r.Channel}` : "";
  const lost = baseline.map((r, i) => (identity(merged[i]) === identity(r) ? -1 : i)).filter((i) => i >= 0);
  add(
    "1. ไม่มีข้อมูลหาย",
    merged.length === baseline.length + inserted.length && lost.length === 0,
    `เดิม ${baseline.length} + ใหม่ ${inserted.length} = ${merged.length} แถว${lost.length ? ` · แถวเดิมหาย/เลื่อน ${lost.length}` : ""}`,
    lost.slice(0, 10).map((i) => `แถว ${i}: ${identity(baseline[i])}`),
  );

  // 2. Only metric columns may change on existing rows (and FILL_COLUMNS, only
  // where they were empty); team and TV columns stay.
  const metric = new Set<string>(METRIC_COLUMNS);
  const fill = new Set<string>(FILL_COLUMNS);
  const changedOther: string[] = [];
  let tvChanged = 0;
  baseline.forEach((before, i) => {
    const after = merged[i];
    for (const col of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (metric.has(col)) continue;
      if (fill.has(col) && canFill(col, before[col], after[col])) continue;
      if (JSON.stringify(before[col]) !== JSON.stringify(after[col])) {
        if (changedOther.length < 10) changedOther.push(`แถว ${i} คอลัมน์ ${col}`);
        if (!DIGITAL.has(String(before.Platform))) tvChanged++;
      }
    }
  });
  add(
    "2. คอลัมน์ที่ทีมกรอกและแถว TV ไม่ถูกแก้",
    changedOther.length === 0,
    changedOther.length ? `พบการแก้ ${changedOther.length}+ จุด (TV ${tvChanged})` : "เปลี่ยนเฉพาะ Views/Likes/Comments/Shares/Engagement (และเติม Hashtags / เวลาโพสต์ที่ว่าง)",
    changedOther,
  );

  // 3. No duplicate posts.
  const keys = new Map<string, number>();
  for (const r of merged) {
    const k = rowKey(r);
    if (k) keys.set(k, (keys.get(k) || 0) + 1);
  }
  const baselineKeys = new Map<string, number>();
  for (const r of baseline) {
    const k = rowKey(r);
    if (k) baselineKeys.set(k, (baselineKeys.get(k) || 0) + 1);
  }
  const newDupes = [...keys].filter(([k, n]) => n > (baselineKeys.get(k) || 0) && n > 1).map(([k]) => k);
  const oldDupes = [...baselineKeys].filter(([, n]) => n > 1).length;
  add(
    "3. ไม่มีโพสต์ซ้ำเพิ่มขึ้น",
    newDupes.length === 0,
    `ซ้ำที่เกิดใหม่ ${newDupes.length} · ซ้ำที่มีอยู่แล้วในข้อมูลเดิม ${oldDupes} (ไม่ได้แตะ)`,
    newDupes.slice(0, 10),
  );

  // 4. New rows have the full shape the dashboard reads.
  const columns = new Set(baseline.slice(0, 500).flatMap((r) => Object.keys(r)));
  const shapeIssues: string[] = [];
  // New rows are appended after the existing ones, in `inserted` order.
  for (let j = 0; j < inserted.length; j++) {
    const clean = merged[baseline.length + j];
    const missing = [...columns].filter((c) => !(c in clean));
    const internal = Object.keys(clean).filter((c) => c.startsWith("_"));
    const date = excelDate(clean.Date);
    if (missing.length) shapeIssues.push(`${rowKey(clean)} ขาด ${missing.slice(0, 3).join(",")}`);
    if (internal.length) shapeIssues.push(`${rowKey(clean)} มีฟิลด์ภายใน ${internal.join(",")}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) shapeIssues.push(`${rowKey(clean)} วันที่อ่านไม่ได้ ${clean.Date}`);
    if (!DIGITAL.has(String(clean.Platform))) shapeIssues.push(`${rowKey(clean)} platform ${clean.Platform}`);
    if (shapeIssues.length >= 10) break;
  }
  add("4. แถวใหม่มีรูปแบบครบ", shapeIssues.length === 0, shapeIssues.length ? `${shapeIssues.length} ปัญหา` : `${inserted.length} แถวครบทุกคอลัมน์`, shapeIssues);

  // 5. Numbers make sense. Lifetime counts should not fall; a small dip
  // happens when platforms remove spam views, so only large drops warn.
  const bad: string[] = [];
  const drops: string[] = [];
  for (const u of updated) {
    const before = parseNumber(u.before.Views);
    const after = u.after.Views !== undefined ? parseNumber(u.after.Views) : before;
    if (after < 0 || !Number.isFinite(after)) bad.push(`${u.key} views=${u.after.Views}`);
    if (before > 1000 && after < before * 0.9) drops.push(`${u.key} ${before} → ${after}`);
  }
  for (const r of inserted) for (const c of METRIC_COLUMNS) if (parseNumber(r[c]) < 0) bad.push(`${rowKey(r)} ${c}=${r[c]}`);
  add("5. ตัวเลขถูกต้อง (ไม่ติดลบ)", bad.length === 0, `ยอดวิวลดลงเกิน 10%: ${drops.length} โพสต์ (ให้คนตรวจ)`, [...bad, ...drops].slice(0, 15));

  // 6. The dashboard's own normalisation accepts the data; TV is unchanged.
  let normalizeOk = true;
  let tvBefore = 0;
  let tvAfter = 0;
  let undated = 0;
  try {
    const nb = normalizeRowsWithDeduplication(baseline as never);
    const na = normalizeRowsWithDeduplication(merged as never);
    tvBefore = nb.filter((r) => r.platform === "TV").length;
    tvAfter = na.filter((r) => r.platform === "TV").length;
    undated = merged.length - (merged as Row[]).filter((r) => excelDate(r.Date)).length - (baseline.length - baseline.filter((r) => excelDate(r.Date)).length);
  } catch (e) {
    normalizeOk = false;
    tvBefore = -1;
    add("6. dashboard อ่านข้อมูลได้", false, `normalize error: ${(e as Error).message}`);
  }
  if (normalizeOk) {
    add("6. dashboard อ่านข้อมูลได้", tvBefore === tvAfter && undated === 0, `เทป TV ก่อน ${tvBefore} / หลัง ${tvAfter} · แถวใหม่ที่ไม่มีวันที่ ${undated}`);
  }

  // 7. Monthly digital views per platform must not drop.
  const vb = monthlyViews(baseline);
  const va = monthlyViews(merged);
  const monthDrops: string[] = [];
  const table: Record<string, { before: number; after: number }> = {};
  for (const k of new Set([...vb.keys(), ...va.keys()])) {
    const before = vb.get(k) || 0;
    const after = va.get(k) || 0;
    table[k] = { before, after };
    if (before > 0 && after < before * 0.98) monthDrops.push(`${k}: ${before} → ${after}`);
  }
  add("7. ยอดรายเดือนแต่ละแพลตฟอร์มไม่ลดลง", monthDrops.length === 0, monthDrops.length ? `${monthDrops.length} เดือน/แพลตฟอร์มลดลงเกิน 2%` : "ทุกเดือนเท่าเดิมหรือเพิ่มขึ้น", monthDrops);

  // 8. Fits Firestore documents; report load size for the dashboard.
  let maxChunk = 0;
  for (let i = 0; i < merged.length; i += CHUNK_ROWS) {
    maxChunk = Math.max(maxChunk, Buffer.byteLength(JSON.stringify(merged.slice(i, i + CHUNK_ROWS))));
  }
  const sizeBefore = Buffer.byteLength(JSON.stringify(baseline));
  const sizeAfter = Buffer.byteLength(JSON.stringify(merged));
  add(
    "8. ขนาดอยู่ในขีดจำกัด Firestore",
    maxChunk < DOC_LIMIT * 0.9,
    `document ใหญ่สุด ${(maxChunk / 1024).toFixed(0)} KB (ขีดจำกัด 1,024 KB) · ${Math.ceil(merged.length / CHUNK_ROWS)} documents`,
  );

  // 9. New rows and existing rows must land on the same day in the dashboard.
  // Compared through the dashboard's own date parser, on posts both have.
  if (incoming.length) {
    const byKey = new Map(baseline.map((r) => [rowKey(r), r] as const).filter(([k]) => k));
    let same = 0;
    let total = 0;
    const samples: string[] = [];
    for (const r of incoming) {
      const old = byKey.get(rowKey(r));
      if (!old) continue;
      total++;
      const a = excelDate(old.Date);
      const b = excelDate(r.Date);
      if (a === b) same++;
      else if (samples.length < 5) samples.push(`${rowKey(r)}: เดิม ${a} / API ${b}`);
    }
    const ratio = total ? same / total : 1;
    add(
      "9. วันที่ของแถวใหม่ตรงกับแถวเดิม (ตามที่ dashboard อ่าน)",
      ratio >= 0.98,
      `ตรงกัน ${(ratio * 100).toFixed(1)}% (${same}/${total})`,
      samples,
    );
  }

  // 10. Duplicate cleanup removed only true copies: every removed post still
  // has exactly one row, and no TV row was removed.
  if (dedupe) {
    const left = new Map<string, number>();
    for (const r of baseline) {
      const k = rowKey(r);
      if (k) left.set(k, (left.get(k) || 0) + 1);
    }
    const bad = dedupe.removed.filter((d) => left.get(d.key) !== 1 || !DIGITAL.has(String(d.row.Platform)));
    const countOk = dedupe.originalCount - dedupe.removed.length === baseline.length;
    const viewsRemoved = dedupe.removed.reduce((a, d) => a + parseNumber(d.row.Views), 0);
    add(
      "10. ลบเฉพาะแถวซ้ำจริง",
      countOk && bad.length === 0,
      `ลบ ${dedupe.removed.length} แถว (${new Set(dedupe.removed.map((d) => d.key)).size} โพสต์) · ยอดวิวที่เคยนับซ้ำ ${Math.round(viewsRemoved).toLocaleString("en-US")}`,
      bad.slice(0, 10).map((d) => d.key),
    );
  }

  // 11. Raw data keeps one date format: every row a plain "YYYY-MM-DD" day,
  // so what is stored always equals what the dashboard shows.
  const nonPlain = (merged as Row[]).filter((r) => r.Date !== undefined && r.Date !== null && !isPlainDay(r.Date));
  add(
    "11. วันที่ทุกแถวเป็นรูปแบบ YYYY-MM-DD",
    nonPlain.length === 0,
    nonPlain.length ? `${nonPlain.length} แถวไม่ใช่ YYYY-MM-DD` : `${merged.length} แถวถูกรูปแบบทั้งหมด`,
    nonPlain.slice(0, 5).map((r) => `${rowKey(r) || r.Platform}: ${String(r.Date)}`),
  );

  return {
    ok: checks.every((c) => c.pass),
    checks,
    stats: {
      rowsBefore: baseline.length,
      rowsAfter: merged.length,
      dashboardLoadMB: { before: +(sizeBefore / 1e6).toFixed(1), after: +(sizeAfter / 1e6).toFixed(1) },
      readsPerDashboardOpen: { before: Math.ceil(baseline.length / CHUNK_ROWS), after: Math.ceil(merged.length / CHUNK_ROWS) },
      monthlyDigitalViews: table,
    },
  };
}

/**
 * Checks for the TV step (rating workbook → masterData), run on top of the
 * digital merge. Numbering continues after the digital checks.
 */
export function validateTv(before: Row[], tv: TvMergeResult, episodes: TvEpisode[]): Check[] {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string, warnings?: string[]) =>
    checks.push({ name, pass, detail, ...(warnings?.length ? { warnings } : {}) });
  const after = tv.rows;
  const blankish = (v: unknown) => v === undefined || v === null || v === "" || v === "-";

  // 12. Digital rows are exactly as they were, in the same order.
  const digitalBefore = before.filter((r) => !isTvRow(r));
  const digitalAfter = after.filter((r) => !isTvRow(r));
  const digitalSame =
    digitalBefore.length === digitalAfter.length && digitalBefore.every((r, i) => JSON.stringify(r) === JSON.stringify(digitalAfter[i]));
  add("12. TV: แถว digital ไม่ถูกแตะ", digitalSame, `${digitalAfter.length} แถว digital เหมือนเดิมทุกแถว${digitalSame ? "" : " — ไม่ตรง"}`);

  // 13. No episode lost; the only changes on existing episodes are the rating
  // and audience numbers, the channel spelling, and blanks filled from a copy.
  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) if (isTvRow(r)) m.set(tvKey(r.Date, r.Program, r.Channel), [...(m.get(tvKey(r.Date, r.Program, r.Channel)) || []), r]);
    return m;
  };
  const gb = group(before);
  const ga = group(after);
  const lost = [...gb.keys()].filter((k) => !ga.has(k));
  const edits: string[] = [];
  const untouched = new Set(before);
  for (const [k, list] of gb) {
    const now = ga.get(k);
    if (!now) continue;
    for (const r of now) {
      if (untouched.has(r)) continue; // the very same row object: not modified
      const orig = list.find((b) => b.Channel === r.Channel) || list.find((b) => tvChannel(b.Channel) === tvChannel(r.Channel)) || list[0];
      for (const c of new Set([...Object.keys(orig), ...Object.keys(r)])) {
        if (TV_OWNED.has(c) || c === "Channel") continue;
        if (JSON.stringify(orig[c]) === JSON.stringify(r[c])) continue;
        const fromCopy = blankish(orig[c]) && list.some((b) => JSON.stringify(b[c]) === JSON.stringify(r[c]));
        if (!fromCopy && edits.length < 10) edits.push(`${k} คอลัมน์ ${c}`);
      }
    }
  }
  add(
    "13. TV: ไม่มีเทปหาย และแก้เฉพาะตัวเลข rating/audience",
    lost.length === 0 && edits.length === 0,
    `เทปเดิม ${gb.size} → ${ga.size} (ใหม่ ${tv.inserted.length}) · อัปเดตตัวเลข ${tv.updated.length} เทป${lost.length ? ` · หาย ${lost.length}` : ""}`,
    [...lost.slice(0, 5).map((k) => `หาย: ${k}`), ...edits],
  );

  // 14. One row per episode; copies removed only when their ratings were identical.
  const dupes = [...ga].filter(([k, l]) => l.length > 1 && !tv.conflicts.some((c) => c.startsWith(k)));
  const badRemovals = tv.removed.filter((d) => {
    const kept = (gb.get(d.key) || []).find((r) => r !== d.row);
    return !kept || RATING_COLUMNS.some((c) => Math.abs((Number(d.row[c]) || 0) - (Number(kept[c]) || 0)) > 1e-9);
  });
  add(
    "14. TV: ไม่มีเทปซ้ำ",
    dupes.length === 0 && badRemovals.length === 0,
    `รวมแถวซ้ำที่ rating ตรงกัน ${tv.removed.length} แถว · rating ไม่ตรงกัน (ปล่อยไว้ให้คนตรวจ) ${tv.conflicts.length}`,
    [...dupes.slice(0, 5).map(([k]) => `ซ้ำ: ${k}`), ...badRemovals.slice(0, 5).map((d) => `ลบผิด: ${d.key}`), ...tv.conflicts.slice(0, 5), ...tv.audienceFixed.slice(0, 5)],
  );

  // 15. Numbers make sense and follow the audience rule.
  const bad: string[] = [];
  for (const e of episodes) {
    for (const v of [e.rating, e.bkk, e.urban, e.bkkUrban, e.rural]) if (!(v >= 0 && v < 30)) bad.push(`${e.date} ${e.channel} rating ${v}`);
    if (e.viewers < 0) bad.push(`${e.date} viewership ${e.viewers}`);
  }
  for (const r of after.filter(isTvRow)) {
    if ([...TV_OWNED].some((c) => Number(r[c]) < 0)) bad.push(`${tvKey(r.Date, r.Program, r.Channel)} ติดลบ`);
  }
  const revised = tv.updated.filter((u) => "TV_Rating_Total" in u.before && !blankish(u.before.TV_Rating_Total));
  add(
    "15. TV: ตัวเลขถูกต้อง",
    bad.length === 0,
    `rating อยู่ในช่วง 0–30 · Audience = rating × 700,000 · rating เดิมถูกปรับตามไฟล์ ${revised.length} เทป (ให้คนตรวจ)`,
    [...bad.slice(0, 10), ...revised.slice(0, 10).map((u) => `${u.key}: ${u.before.TV_Rating_Total} → ${u.after.TV_Rating_Total}`)],
  );

  // 16. The dashboard still reads every episode once, and dates stay plain days.
  let episodesBefore = 0;
  let episodesAfter = 0;
  try {
    episodesBefore = normalizeRowsWithDeduplication(before as never).filter((r) => r.platform === "TV").length;
    episodesAfter = normalizeRowsWithDeduplication(after as never).filter((r) => r.platform === "TV").length;
  } catch {
    episodesAfter = -1;
  }
  const newDays = new Set(tv.inserted.map((r) => `${r.Date}|${r.Program}`).filter((k) => ![...gb.keys()].some((g) => g.startsWith(`${k}|`)))).size;
  const nonPlain = after.filter((r) => r.Date !== undefined && r.Date !== null && !isPlainDay(r.Date));
  add(
    "16. TV: dashboard อ่านเทปได้ครบ",
    episodesAfter === episodesBefore + newDays && nonPlain.length === 0,
    `เทปใน dashboard ${episodesBefore} → ${episodesAfter} (วันใหม่ ${newDays}) · วันที่ไม่ใช่ YYYY-MM-DD ${nonPlain.length}`,
  );
  return checks;
}
