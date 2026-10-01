// Advanced → คำแนะนำ: fixed, explainable rules over the same rows as the
// report pages. Every advice carries the numbers it was decided on and the
// clips behind it; a rule without enough clips says so instead of guessing.
// Nothing here changes data. Comparisons stay inside one platform + format
// (Shorts with Shorts) and use medians, so one viral clip cannot swing them.
//
// Relative imports only: tests run this file directly with Node.
import { addDays } from "./growth.ts";
import { watchShare } from "./quality.ts";
import type { RecordRow } from "./types.ts";

export type AdviceLevel = "good" | "warn" | "info";

export interface Advice {
  rule: number;
  level: AdviceLevel;
  /** e.g. "YouTube Shorts". */
  group: string;
  title: string;
  /** What the numbers show. */
  seen: string;
  /** What to try. */
  action: string;
  /** How it was decided (shown on request). */
  criteria: string;
  /** Clips behind the advice, most relevant first (up to 10). */
  clips: RecordRow[];
  /** Views involved: advice touching more views comes first. */
  weight: number;
  /** A link between two things, not proof that one causes the other. */
  correlation: boolean;
}

export interface AdviceResult {
  items: Advice[];
  /** Rules with enough clips somewhere but nothing past their thresholds. */
  nothingFound: { rule: number; name: string }[];
  /** Rules that found no group with enough clips. */
  notEnough: { rule: number; name: string; need: string }[];
}

/** Rules call this when their data minimum is met, finding or not. */
type Enough = (rule: number) => void;

export const RULES: Record<number, { name: string; need: string }> = {
  1: { name: "ความยาวคลิปสั้นที่ได้วิวมากที่สุด", need: "คลิปสั้น (ไม่เกิน 3 นาที) อย่างน้อย 2 ช่วงความยาว ช่วงละ 10 คลิป ในรูปแบบเดียวกัน" },
  2: { name: "3 วินาทีแรกของ Instagram Reels", need: "Reels ที่มีข้อมูลการปัดทิ้งอย่างน้อย 10 คลิป" },
  3: { name: "ประเภทเนื้อหาที่ดี / ไม่ดี", need: "ประเภทละอย่างน้อย 8 คลิป ในรูปแบบเดียวกัน" },
  4: { name: "ER สูงแต่วิวต่ำ", need: "รูปแบบละอย่างน้อย 10 คลิป และพบอย่างน้อย 3 คลิปที่เข้าเกณฑ์" },
  5: { name: "โพสต์ถี่ขึ้นแต่วิวต่อคลิปลด", need: "ทั้งสองช่วงมีอย่างน้อย 10 คลิปในรูปแบบเดียวกัน" },
  6: { name: "วันที่โพสต์", need: "อย่างน้อย 2 วันในสัปดาห์ วันละ 8 คลิป" },
  7: { name: "เวลาที่โพสต์", need: "อย่างน้อย 2 ช่วงเวลา ช่วงละ 8 คลิปที่มีเวลาโพสต์" },
};

/** Clips younger than this are still gaining: left out of view comparisons. */
const FRESH_DAYS = 2;
const MIN_WATCH_VIEWS = 50;

// ---------- helpers ----------

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const sum = (rows: RecordRow[]) => rows.reduce((a, r) => a + r.views, 0);
const k = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(Math.round(v)));
const x = (v: number) => `${v.toFixed(1)}×`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function groupName(r: Pick<RecordRow, "platform" | "vdoType">) {
  const f = r.vdoType || "ไม่ระบุรูปแบบ";
  return f.toLowerCase().includes(r.platform.toLowerCase()) ? f : `${r.platform} ${f}`;
}

function groups(rows: RecordRow[]) {
  const m = new Map<string, RecordRow[]>();
  for (const r of rows) m.set(groupName(r), [...(m.get(groupName(r)) || []), r]);
  return m;
}

function bucketsOf<T extends string>(rows: RecordRow[], bucket: (r: RecordRow) => T | null) {
  const m = new Map<T, RecordRow[]>();
  for (const r of rows) {
    const b = bucket(r);
    if (b !== null) m.set(b, [...(m.get(b) || []), r]);
  }
  return m;
}

/** Best and worst bucket by median views among buckets with at least `min` clips. */
function compareBuckets<T extends string>(m: Map<T, RecordRow[]>, min: number, order: T[] | undefined, enough: () => void) {
  const ok = [...m.entries()].filter(([, l]) => l.length >= min).map(([b, l]) => ({ b, l, med: median(l.map((r) => r.views)) }));
  if (ok.length < 2) return null;
  enough();
  ok.sort((a, z) => z.med - a.med);
  const best = ok[0];
  const worst = ok[ok.length - 1];
  if (!worst.med || best.med / worst.med < 1.3) return { ok, best, worst, ratio: worst.med ? best.med / worst.med : 0, strong: false };
  if (order) ok.sort((a, z) => order.indexOf(a.b) - order.indexOf(z.b));
  return { ok, best, worst, ratio: best.med / worst.med, strong: true };
}

const byViews = (rows: RecordRow[]) => [...rows].sort((a, b) => b.views - a.views);

// ---------- rules ----------

const SHORT_BUCKETS = ["ไม่ถึง 15 วิ", "15–30 วิ", "30–45 วิ", "45–60 วิ", "60–90 วิ", "90 วิ–3 นาที"] as const;

export function lengthSec(r: RecordRow) {
  return r.videoLengthSec > 0 ? r.videoLengthSec : r.durationMin > 0 ? r.durationMin * 60 : 0;
}

function lengthBucket(sec: number): string | null {
  if (sec <= 0) return null;
  const i = [15, 30, 45, 60, 90, 180].findIndex((e) => sec < e);
  return i < 0 ? null : SHORT_BUCKETS[i];
}

function rule1(group: string, rows: RecordRow[], enough: Enough): Advice | null {
  const lens = rows.map(lengthSec).filter((s) => s > 0);
  if (!lens.length) return null;
  // Short-form only: there the length is a creative choice. Full episodes and
  // lives run as long as the broadcast, so comparing their lengths mixes
  // different kinds of content.
  if (median(lens) > 180) return null;
  const m = bucketsOf(rows, (r) => lengthBucket(lengthSec(r)));
  const c = compareBuckets(m, 10, [...SHORT_BUCKETS], () => enough(1));
  if (!c?.strong) return null;
  const watched = (l: RecordRow[]) => {
    const w = l.filter((r) => r.views >= MIN_WATCH_VIEWS && watchShare(r) !== null);
    const views = sum(w);
    return views ? w.reduce((a, r) => a + watchShare(r)! * r.views, 0) / views : null;
  };
  const line = (b: { b: string; l: RecordRow[]; med: number }) => {
    const w = watched(b.l);
    return `ยาว ${b.b} วิวกลาง ${k(b.med)} (${b.l.length} คลิป${w !== null ? ` · ดูเฉลี่ย ${pct(w)}` : ""})`;
  };
  return {
    rule: 1,
    level: "good",
    group,
    title: `${group} ยาว ${c.best.b} ได้วิวมากที่สุด`,
    seen: `${line(c.best)} · ${line(c.worst)} · ต่างกัน ${x(c.ratio)}`,
    action: `ลองทำ ${group} ให้อยู่ในช่วง ${c.best.b} มากขึ้น`,
    criteria: `เฉพาะรูปแบบคลิปสั้น (ความยาวกลางไม่เกิน 3 นาที) · แบ่งตามความยาวคลิปจาก API (หรือ Duration_Min) ช่วงละอย่างน้อย 10 คลิป · ช่วงที่วิวกลางสูงสุดต้องมากกว่าช่วงต่ำสุด ≥1.3× · % ที่ดูแสดงประกอบเท่านั้น เพราะคลิปยิ่งยาว % ยิ่งลดลงเองเสมอ`,
    clips: byViews(c.best.l).slice(0, 10),
    weight: sum(c.best.l) + sum(c.worst.l),
    correlation: true,
  };
}

function rule2(rows: RecordRow[], enough: Enough): Advice | null {
  const reels = rows.filter((r) => r.platform === "Instagram" && r.skipRate !== null && r.views >= MIN_WATCH_VIEWS);
  if (reels.length < 10) return null;
  enough(2);
  const kept = (r: RecordRow) => 1 - (r.skipRate as number) / 100;
  const med = median(reels.map(kept));
  const weak = reels.filter((r) => kept(r) < med * 0.8).sort((a, b) => kept(a) - kept(b));
  if (weak.length < 3) return null;
  const strong = [...reels].sort((a, b) => kept(b) - kept(a)).slice(0, 3);
  return {
    rule: 2,
    level: "warn",
    group: "Instagram Reels",
    title: `Reels ${weak.length} คลิปถูกปัดทิ้งเร็วกว่าปกติ`,
    seen: `ค่ากลางคนที่ไม่ปัดทิ้งช่วงแรก ${pct(med)} · ${weak.length} คลิปนี้ ${pct(kept(weak[0]))}–${pct(kept(weak[weak.length - 1]))} · คลิปที่เปิดได้ดีที่สุด ${pct(kept(strong[0]))}`,
    action: `ปรับ 3 วินาทีแรก: ดูช่วงเปิดของคลิปที่คนไม่ปัดทิ้งมากที่สุด เช่น “${strong[0].topic.slice(0, 50)}” เป็นตัวอย่าง`,
    criteria: `Instagram Reels ที่มี 50+ วิวและมีอัตราปัดทิ้งจาก API อย่างน้อย 10 คลิป · คลิปที่ไม่ปัดทิ้งต่ำกว่า 80% ของค่ากลาง · ต้องพบอย่างน้อย 3 คลิป`,
    clips: weak.slice(0, 10),
    weight: sum(weak),
    correlation: false,
  };
}

function rule3(group: string, rows: RecordRow[], enough: Enough): Advice[] {
  const groupMed = median(rows.map((r) => r.views));
  if (!groupMed) return [];
  const m = bucketsOf(rows, (r) => (r.topicType && r.topicType !== "ไม่ระบุ" ? r.topicType : null));
  const out: Advice[] = [];
  for (const [topic, l] of m) {
    if (l.length < 8) continue;
    enough(3);
    const med = median(l.map((r) => r.views));
    const ratio = med / groupMed;
    if (ratio < 1.3 && ratio > 0.7) continue;
    const good = ratio >= 1.3;
    out.push({
      rule: 3,
      level: good ? "good" : "warn",
      group,
      title: good ? `${group}: “${topic}” ได้วิวสูงกว่าปกติ` : `${group}: “${topic}” ได้วิวต่ำกว่าปกติ`,
      seen: `วิวกลาง “${topic}” ${k(med)} (${l.length} คลิป) · ค่ากลางของ ${group} ${k(groupMed)} (${rows.length} คลิป) · ${good ? x(ratio) : `${pct(ratio)} ของค่ากลาง`}`,
      action: good ? `ทำเนื้อหาประเภท “${topic}” ใน ${group} เพิ่ม` : `ทบทวนการทำ “${topic}” ใน ${group}: มุมเล่า ภาพปก หรือชื่อคลิป`,
      criteria: `ประเภทเนื้อหาละอย่างน้อย 8 คลิป · วิวกลาง ≥1.3× (ดี) หรือ ≤0.7× (ต่ำ) ของค่ากลางคลิปรูปแบบเดียวกันในช่วงนี้`,
      clips: (good ? byViews(l) : [...l].sort((a, b) => a.views - b.views)).slice(0, 10),
      weight: sum(l),
      correlation: true,
    });
  }
  return out;
}

function rule4(group: string, rows: RecordRow[], enough: Enough): Advice | null {
  const list = rows.filter((r) => r.views >= MIN_WATCH_VIEWS);
  if (list.length < 10) return null;
  enough(4);
  const er = (r: RecordRow) => r.engagement / r.views;
  const medEr = median(list.map(er));
  const medViews = median(list.map((r) => r.views));
  const hits = list.filter((r) => medEr > 0 && er(r) >= medEr * 1.5 && r.views <= medViews * 0.7).sort((a, b) => er(b) - er(a));
  if (hits.length < 3) return null;
  return {
    rule: 4,
    level: "good",
    group,
    title: `${group}: ${hits.length} คลิปคนชอบมากแต่ยังเข้าถึงน้อย`,
    seen: `ER ของคลิปเหล่านี้ ${pct(er(hits[hits.length - 1]))}–${pct(er(hits[0]))} (ค่ากลาง ${(medEr * 100).toFixed(1)}%) แต่วิวไม่เกิน ${k(medViews * 0.7)} (ค่ากลาง ${k(medViews)})`,
    action: `ดันคลิปเหล่านี้ต่อ (ปักหมุด แชร์ซ้ำ ตัดเป็นคลิปสั้น) หรือทำเนื้อหาแนวเดียวกันอีก`,
    criteria: `คลิปที่มี 50+ วิว รูปแบบละอย่างน้อย 10 คลิป · ER ≥1.5× และวิว ≤0.7× ของค่ากลางรูปแบบเดียวกัน · ต้องพบอย่างน้อย 3 คลิป`,
    clips: hits.slice(0, 10),
    weight: sum(hits),
    correlation: false,
  };
}

function rule5(group: string, rows: RecordRow[], prev: RecordRow[], enough: Enough): Advice | null {
  if (rows.length < 10 || prev.length < 10) return null;
  enough(5);
  const countChange = rows.length / prev.length - 1;
  const medNow = median(rows.map((r) => r.views));
  const medPrev = median(prev.map((r) => r.views));
  if (!medPrev) return null;
  const viewChange = medNow / medPrev - 1;
  if (countChange < 0.2 || viewChange > -0.2) return null;
  return {
    rule: 5,
    level: "warn",
    group,
    title: `${group} โพสต์ถี่ขึ้น แต่วิวต่อคลิปลดลง`,
    seen: `จำนวนคลิป ${prev.length} → ${rows.length} (+${pct(countChange)}) · วิวกลางต่อคลิป ${k(medPrev)} → ${k(medNow)} (${pct(viewChange)}) · วิวรวม ${k(sum(prev))} → ${k(sum(rows))}`,
    action: `ดูว่าคลิปที่เพิ่มมาดึงวิวกันเองหรือไม่ ลองลดจำนวนแล้วเน้นคุณภาพ แล้วเทียบผลในช่วงถัดไป`,
    criteria: `เทียบกับช่วงเปรียบเทียบ (ตามตัวกรองด้านบน) · ทั้งสองช่วงมีอย่างน้อย 10 คลิป · จำนวนคลิปเพิ่ม ≥20% และวิวกลางต่อคลิปลด ≥20%`,
    clips: [...rows].sort((a, b) => a.views - b.views).slice(0, 10),
    weight: sum(rows) + sum(prev),
    correlation: true,
  };
}

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function rule6(group: string, rows: RecordRow[], enough: Enough): Advice | null {
  const m = bucketsOf(rows, (r) => WEEKDAYS[new Date(`${r.date}T00:00:00Z`).getUTCDay()] ?? null);
  const c = compareBuckets(m, 8, WEEKDAYS, () => enough(6));
  if (!c?.strong) return null;
  return {
    rule: 6,
    level: "info",
    group,
    title: `${group} ที่ลงวัน${c.best.b}ได้วิวสูงกว่า`,
    seen: `วัน${c.best.b} วิวกลาง ${k(c.best.med)} (${c.best.l.length} คลิป) · วัน${c.worst.b} ${k(c.worst.med)} (${c.worst.l.length} คลิป) · ต่างกัน ${x(c.ratio)} · ${c.ok.map((o) => `${o.b} ${k(o.med)}`).join(" · ")}`,
    action: `ลองวางคลิปสำคัญของ ${group} ในวัน${c.best.b} แล้วเทียบผล`,
    criteria: `แบ่งตามวันที่โพสต์ วันละอย่างน้อย 8 คลิป · วันที่วิวกลางสูงสุดต้องมากกว่าวันต่ำสุด ≥1.3×`,
    clips: byViews(c.best.l).slice(0, 10),
    weight: sum(c.best.l) + sum(c.worst.l),
    correlation: true,
  };
}

const TIME_SLOTS = ["เช้า 05:00–10:59", "กลางวัน 11:00–15:59", "เย็น 16:00–20:59", "ดึก 21:00–04:59"];

export function timeSlot(hhmm: string): string | null {
  const h = Number(hhmm.match(/^(\d{1,2}):\d{2}/)?.[1]);
  if (!Number.isFinite(h) || !/^\d{1,2}:\d{2}/.test(hhmm)) return null;
  return h >= 5 && h < 11 ? TIME_SLOTS[0] : h >= 11 && h < 16 ? TIME_SLOTS[1] : h >= 16 && h < 21 ? TIME_SLOTS[2] : TIME_SLOTS[3];
}

function rule7(group: string, rows: RecordRow[], enough: Enough): Advice | null {
  const m = bucketsOf(rows, (r) => timeSlot(r.publishTime));
  const c = compareBuckets(m, 8, TIME_SLOTS, () => enough(7));
  if (!c?.strong) return null;
  const known = [...m.values()].reduce((a, l) => a + l.length, 0);
  return {
    rule: 7,
    level: "info",
    group,
    title: `${group} ที่ลงช่วง${c.best.b.split(" ")[0]}ได้วิวสูงกว่า`,
    seen: `${c.best.b} วิวกลาง ${k(c.best.med)} (${c.best.l.length} คลิป) · ${c.worst.b} ${k(c.worst.med)} (${c.worst.l.length} คลิป) · ต่างกัน ${x(c.ratio)} · มีเวลาโพสต์ ${known} จาก ${rows.length} คลิป`,
    action: `ลองลงคลิปสำคัญของ ${group} ช่วง ${c.best.b} แล้วเทียบผล`,
    criteria: `เวลาโพสต์ (เวลาไทย) จากข้อมูลที่ sync ดึงมา · ช่วงละอย่างน้อย 8 คลิป · ช่วงที่วิวกลางสูงสุดต้องมากกว่าช่วงต่ำสุด ≥1.3×`,
    clips: byViews(c.best.l).slice(0, 10),
    weight: sum(c.best.l) + sum(c.worst.l),
    correlation: true,
  };
}

// ---------- all rules ----------

/**
 * `rows`: clips posted in the report range that pass the filters.
 * `prev`: the same for the compare range (rule 5), or [] without one.
 * `latestDate`: newest day in the data; clips from its last two days are still gaining and are left out of view comparisons.
 */
export function computeAdvice(rows: RecordRow[], prev: RecordRow[], latestDate: string): AdviceResult {
  const cutoff = latestDate ? addDays(latestDate, -(FRESH_DAYS - 1)) : "9999-12-31";
  const digital = rows.filter((r) => r.platform !== "TV" && r.views > 0);
  const settled = digital.filter((r) => r.date < cutoff);
  const prevDigital = prev.filter((r) => r.platform !== "TV" && r.views > 0);
  const byGroup = groups(settled);
  const prevByGroup = groups(prevDigital);

  const items: Advice[] = [];
  const had = new Set<number>();
  const enough: Enough = (rule) => had.add(rule);
  const add = (a: Advice | null) => a && items.push(a);
  add(rule2(digital, enough));
  for (const [group, list] of byGroup) {
    add(rule1(group, list, enough));
    items.push(...rule3(group, list, enough));
    add(rule4(group, list, enough));
    add(rule5(group, list, prevByGroup.get(group) || [], enough));
    add(rule6(group, list, enough));
    add(rule7(group, list, enough));
  }
  items.sort((a, b) => b.weight - a.weight);
  const found = new Set(items.map((a) => a.rule));
  const rules = Object.entries(RULES).map(([n, r]) => ({ rule: Number(n), ...r }));
  return {
    items,
    nothingFound: rules.filter((r) => had.has(r.rule) && !found.has(r.rule)).map(({ rule, name }) => ({ rule, name })),
    notEnough: rules.filter((r) => !had.has(r.rule)),
  };
}
