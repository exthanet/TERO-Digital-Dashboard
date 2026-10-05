// รายได้ → Monthly ACC: monthly numbers per YouTube channel from the CMS
// (YouTube Analytics, collected by the daily sync into accMonthly/{YYYY-MM}).
// Columns follow the CMS "Channel summary" report; Ad-Enabled views are not in
// the API, so that column stays empty. Revenue is YouTube's estimate in USD.
//
// Relative imports only: the sync and the tests run this file directly with Node.

export const TERO_DIGITAL = "UCq2_AaNWBd0kxzR1HL2yhsw";

/**
 * The 24 lines of the accounting team's report, in their order, with each Asset
 * Channel ID. `program`: a show inside the TERO DIGITAL channel, counted from
 * its own clips; the TERO DIGITAL line then holds the rest of the channel.
 * `id: null`: not found in the connected CMS (left empty, noted on the page).
 */
export const ACC_CHANNELS: { name: string; id: string | null; program?: string }[] = [
  { name: "TeroRadioChannel", id: "UCNcZ9a94asv8TOP435PaCiA" },
  { name: "brainchild tv3", id: null },
  { name: "TERO ENTERTAINMENT", id: "UCKXg1i42GPbDZDDBs-dzweg" },
  { name: "ครอบครัวข่าวเด็ก (Kids Fun)", id: "UCrMym6dFPiXrRfzTvgs5WnQ" },
  { name: "Bangkok บันเทิง", id: "UCz9BY_eMMMB46gax2gJ6wVg" },
  { name: "Liamjone", id: "UCeH7oHcqNjTV9bP0WGrc_hg" },
  { name: "คิดเช่นเห็นต่าง", id: "UCQapGJ2gyv8hVcAEKYbIXxQ" },
  { name: "TV Series", id: "UCgYPTntz329k-am5DgX-oTw" },
  { name: "Variety", id: "UCahIGAjfjL0IGK-DmjeoKAg" },
  { name: "Sports", id: "UCuWVRGrXK2k2UaQyPXAiCHw" },
  { name: "TERO REALITY", id: "UCLZd__C13KacoUKip4I5cJw" },
  { name: "THE CHART SHOW", id: "UCx01FWE_GQz5lZD8aliHfMw" },
  { name: "PopolayTV", id: "UC0DCRQHMv5ZvlJPSUUQP-2w" },
  { name: "Miss Thailand World", id: "UCEg8yyKqqJb8GTv_fhdNRBw" },
  { name: "Nanake555", id: "UCuTTT_6JxuAtRdvF3BvVjdg" },
  { name: "This is catRadio", id: "UClbaLl8eAG2zRpaO1eNntPg" },
  { name: "นครหลวงโปรโมชัน (NAKORNLOUNG Promotion)", id: "UCJjN-raMjH99hBaRwPs_Mwg" },
  { name: "TERO Digital", id: TERO_DIGITAL },
  { name: "ถกไม่เถียง", id: TERO_DIGITAL, program: "ถกไม่เถียง" },
  { name: "เงินทองของจริง", id: TERO_DIGITAL, program: "เงินทองของจริง" },
  { name: "Tero Performance course", id: null },
  { name: "Bsitein", id: "UCpyL94ggjcjv-gqGKJAnSmA" },
  { name: "Krajokhokdan (กระจกหกด้าน)", id: "UCXW556sbVWURyoo7_j6xE0Q" },
  { name: "ThailandPostmart", id: "UCkqDZ_jbjICMp-Ve32hJqfg" },
];

export interface AccRow {
  name: string;
  /** "" when the channel is not in the connected CMS. */
  channelId: string;
  /** Show counted from its clips inside the channel. */
  program?: string;
  /** Not in the connected CMS: no numbers. */
  missing?: boolean;
  premiumViews: number;
  views: number;
  watchPage: number;
  embedded: number;
  channelPage: number;
  live: number;
  onDemand: number;
  adRevenue: number;
  premiumRevenue: number;
}

export interface AccMonth {
  /** "2026-09" */
  month: string;
  /** Last day counted ("2026-09-30", or earlier while the month runs). */
  through: string;
  updatedAt: string;
  rows: AccRow[];
}

export const NUM_KEYS = ["premiumViews", "views", "watchPage", "embedded", "channelPage", "live", "onDemand", "adRevenue", "premiumRevenue"] as const;

export type AccNums = Pick<AccRow, (typeof NUM_KEYS)[number]>;

export function accTotals(rows: AccNums[]): AccNums {
  const t = Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) as AccNums;
  for (const r of rows) for (const k of NUM_KEYS) t[k] += r[k] || 0;
  return t;
}

/** a − b per number, never below 0 (rounding on YouTube's side). */
export function accMinus(a: AccNums, b: AccNums): AccNums {
  return Object.fromEntries(NUM_KEYS.map((k) => [k, Math.max(0, Math.round(((a[k] || 0) - (b[k] || 0)) * 1e6) / 1e6)])) as AccNums;
}

/**
 * Which uploads belong to each show: the Program in masterData first, then the
 * show's name in the title (older clips are not in masterData).
 */
export function programVideoIds(uploads: { id: string; title: string }[], programOf: Map<string, string>, programs: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(programs.map((p) => [p, []]));
  const squash = (t: string) => t.replace(/\s+/g, "");
  for (const u of uploads) {
    const known = programOf.get(u.id);
    const p = known !== undefined ? programs.find((x) => x === known) : programs.find((x) => squash(u.title).includes(squash(x)));
    if (p) out[p].push(u.id);
  }
  return out;
}

/** Why a line is counted the way it is (shown on the page and in the export). */
export const rowNote = (r: Pick<AccRow, "program" | "channelId" | "name">) =>
  r.program ? `คลิปรายการ${r.program}ในช่อง TERO DIGITAL` : r.channelId === TERO_DIGITAL ? "ช่อง TERO DIGITAL ไม่รวมถกไม่เถียงและเงินทองของจริง" : "";

/** Rows for the Excel export: the CMS column names, money in the chosen currency (rate = THB per USD, 1 for USD). */
export function accSheetRows(m: AccMonth, rate = 1, currency = "USD"): Record<string, string | number>[] {
  const money = (v: number) => Math.round(v * rate * 100) / 100;
  const line = (name: string, channelId: string, r: AccNums, missing = false) => {
    const v = (n: number) => (missing ? "" : n);
    return {
      "Channel Display Name": name,
      "Asset Channel ID": channelId,
      "YouTube Premium views": v(r.premiumViews),
      "Owned Views": v(r.views),
      "Owned Views : Watch Page": v(r.watchPage),
      "Owned Views : Embedded Player": v(r.embedded),
      "Owned Views : Channel Page": v(r.channelPage),
      "Owned Views : Live": v(r.live),
      "Owned Views : On Demand": v(r.onDemand),
      "Owned Views : Ad-Enabled": "",
      [`Ads Partner Revenue (${currency})`]: v(money(r.adRevenue)),
      [`YouTube Premium partner revenue (${currency})`]: v(money(r.premiumRevenue)),
      "หมายเหตุ": missing ? "ไม่พบช่องนี้ใน CMS ที่เชื่อมต่อ" : rowNote(r as AccRow),
    };
  };
  return [...m.rows.map((r) => line(r.name, r.channelId, r, r.missing)), line("รวม", "", accTotals(m.rows))];
}

/** Calendar months from `from` to `to` ("YYYY-MM"), inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Last day of a month, "2026-02" → "2026-02-28". */
export const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
