// YouTube Revenue from the team's Google Sheet. Revenue comes from the CMS API
// every day; the sheet is imported only by an admin, on Import Revenue, when it
// has something to update. Only the "revenue-sheet" run, started by an admin (not
// the daily sync), reads the sheet into a draft (syncConfig/revenueSheetDraft) and says what
// is new or changed; the admin checks it in the same preview as a file and saves.
// The link is set in Import Revenue (syncConfig/revenueSheet); the sheet stays
// private and is shared with the sync's service account as Viewer. It is read
// with the same parser as the Import button (parseRevenueWorkbook).
//
// Relative imports only: the sync runs this file directly with Node.
import { parseRevenueWorkbook, type MonthlyRevenueItem, type RevenueData, type RevenueWorkbook } from "../dashboard/revenueParser.ts";
import { decodeFields, docId, encodeFields, getAccessToken, type Firestore, type ServiceAccount } from "./firestoreRest.ts";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const SHEET_CONFIG = "syncConfig/revenueSheet";
/** What the last read found, for Import Revenue (written by the sync only). */
export const SHEET_STATUS = "syncConfig/revenueSheetStatus";
/** The sheet as last read, waiting for an admin to import it (written by the sync only). */
export const SHEET_DRAFT = "syncConfig/revenueSheetDraft";

/** The file id of a Google Sheets / Drive link; "" when it is not one. */
export function sheetIdOf(url: string): string {
  const m = String(url || "").match(/^https:\/\/(?:docs|drive)\.google\.com\/(?:spreadsheets\/d|file\/d)\/([\w-]{20,})/);
  return m ? m[1] : "";
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const isZip = (buf: ArrayBuffer) => {
  const head = new Uint8Array(buf.slice(0, 2));
  return head[0] === 0x50 && head[1] === 0x4b;
};

/**
 * The sheet as an .xlsx file. A Google Sheet comes through its export link, which
 * needs no API turned on in Google Cloud (tested 2026-10-16); an Excel file kept
 * in Drive falls back to the Drive API (that one must be enabled).
 */
export async function downloadSheet(id: string, token: string, fetcher: typeof fetch = fetch): Promise<ArrayBuffer> {
  const get = (u: string) => fetcher(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
  const exported = await get(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  if (exported.ok) {
    const buf = await exported.arrayBuffer();
    if (isZip(buf)) return buf;
  }
  const meta = await get(`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&supportsAllDrives=true`);
  const info = (await meta.json().catch(() => ({}))) as { mimeType?: string; error?: { message?: string } };
  if (!meta.ok) {
    const msg = info.error?.message || String(meta.status);
    if (meta.status === 404 || /has not been used|disabled/i.test(msg)) throw new Error("เปิด Sheet ไม่ได้: ยังไม่ได้แชร์ให้บัญชีระบบ (Viewer) หรือลิงก์ผิด");
    throw new Error(`Google Drive: ${msg.slice(0, 160)}`);
  }
  const native = info.mimeType === "application/vnd.google-apps.spreadsheet";
  const res = await get(
    native
      ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
      : `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
  );
  if (!res.ok) throw new Error(`Google Drive: download ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!isZip(buf)) throw new Error("ไฟล์ใน Drive ไม่ใช่ Google Sheet หรือ .xlsx");
  return buf;
}

export const readWorkbook = (buf: ArrayBuffer): Promise<RevenueWorkbook> => parseRevenueWorkbook(new File([buf], "revenue-sheet.xlsx"));

export interface SheetMerge {
  data: RevenueData;
  /** Months new to the system, months whose numbers changed (any sheet), months the sheet does not have (kept). */
  added: string[];
  changed: string[];
  kept: string[];
  problem: string;
}

/** Same numbers and labels (a stored null and a missing field are both empty). */
function sameItem(a: MonthlyRevenueItem | undefined, b: MonthlyRevenueItem): boolean {
  if (!a) return false;
  const x = a as unknown as Record<string, unknown>;
  const y = b as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => {
    const u = x[k] ?? null;
    const v = y[k] ?? null;
    return typeof u === "number" || typeof v === "number" ? Math.abs(Number(u || 0) - Number(v || 0)) < 1e-9 : String(u ?? "") === String(v ?? "");
  });
}

/** "Merge" exactly as Import Revenue does it, with what changed. */
export function mergeSheet(current: RevenueData | null, wb: RevenueWorkbook, now = new Date().toISOString()): SheetMerge {
  const added = new Set<string>();
  const changed = new Set<string>();
  const combine = (cur: MonthlyRevenueItem[] | undefined, incoming: MonthlyRevenueItem[] | null) => {
    if (!incoming) return cur;
    const map = new Map((cur || []).map((m) => [m.month, m]));
    for (const m of incoming) {
      if (!map.has(m.month)) added.add(m.month);
      else if (!sameItem(map.get(m.month), m)) changed.add(m.month);
      map.set(m.month, m);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  };
  const monthly = combine(current?.monthly, wb.overall) || [];
  const rates = wb.rates ? { ...(current?.rates || {}), ...wb.rates } : current?.rates;
  for (const [m, r] of Object.entries(wb.rates || {})) if (current?.rates?.[m] !== r && current?.rates?.[m] !== undefined) changed.add(m);
  const inSheet = new Set((wb.overall || []).map((m) => m.month));
  const kept = (current?.monthly || []).map((m) => m.month).filter((m) => wb.overall && !inSheet.has(m));
  const data: RevenueData = {
    generatedAt: now,
    monthly,
    digital: combine(current?.digital, wb.digital),
    entertainment: combine(current?.entertainment, wb.entertainment),
    rates,
  };
  const problem = !wb.overall && !current?.monthly.length
    ? "ไม่พบ sheet Overall และยังไม่มีข้อมูลรวมในระบบ"
    : !wb.overall?.length && !wb.digital?.length && !wb.entertainment?.length
      ? "ไม่พบข้อมูลรายได้รายเดือนใน Sheet"
      : "";
  return { data, added: [...added].sort(), changed: [...changed].sort(), kept, problem };
}

export async function loadRevenueData(db: Firestore): Promise<{ data: RevenueData | null; raw: { id: string; fields: Record<string, unknown> }[] }> {
  const raw = (await db.listRaw("revenueData")).map((d) => ({ id: docId(d.name), fields: d.fields || {} }));
  const get = (id: string) => {
    const d = raw.find((x) => x.id === id);
    return d ? decodeFields(d.fields as Parameters<typeof decodeFields>[0]) : null;
  };
  const monthly = (get("monthly")?.monthly as MonthlyRevenueItem[] | undefined) || [];
  if (!monthly.length) return { data: null, raw };
  const list = (id: string) => {
    const l = get(id)?.monthly as MonthlyRevenueItem[] | undefined;
    return l && l.length ? l : undefined;
  };
  return {
    data: {
      generatedAt: String(get("meta")?.generatedAt || ""),
      monthly,
      digital: list("digital"),
      entertainment: list("entertainment"),
      rates: (get("rates")?.rates as Record<string, number> | undefined) || undefined,
    },
    raw,
  };
}

const clean = (list: MonthlyRevenueItem[] | null) => (list ? list.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === undefined ? null : v]))) : null);

export interface SheetStatus {
  at: string;
  ok: boolean;
  /** "พร้อมนำเข้า: ใหม่ ต.ค. 26 · อัปเดต ก.ย. 26", "ไม่มีข้อมูลใหม่", "ยังไม่ได้ตั้งลิงก์" */
  detail: string;
  error: string;
  shareWith: string;
  added: string[];
  changed: string[];
}

const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const th = (m: string) => `${TH[Number(m.slice(5, 7)) - 1] || m} ${m.slice(2, 4)}`;

/**
 * Read the sheet and compare it with what is stored. Nothing is written here:
 * `draft` is the workbook for Import Revenue, null when there is no link or it failed.
 */
export async function checkSheet(db: Firestore, sa: ServiceAccount | null, fetcher: typeof fetch = fetch): Promise<{ status: SheetStatus; draft: RevenueWorkbook | null }> {
  const status: SheetStatus = { at: new Date().toISOString(), ok: true, detail: "ยังไม่ได้ตั้งลิงก์", error: "", shareWith: sa?.client_email || "", added: [], changed: [] };
  const cfg = await db.get(SHEET_CONFIG);
  const url = cfg ? String(decodeFields(cfg.fields || {}).url || "") : "";
  if (!url) return { status, draft: null };
  try {
    const id = sheetIdOf(url);
    if (!id) throw new Error("ลิงก์ไม่ใช่ Google Sheet");
    if (!sa) throw new Error("no service account");
    const wb = await readWorkbook(await downloadSheet(id, await getAccessToken(sa, DRIVE_SCOPE), fetcher));
    const merge = mergeSheet((await loadRevenueData(db)).data, wb);
    if (merge.problem) throw new Error(merge.problem);
    status.added = merge.added;
    status.changed = merge.changed;
    const parts = [merge.added.length ? `ใหม่ ${merge.added.map(th).join(", ")}` : "", merge.changed.length ? `อัปเดต ${merge.changed.map(th).join(", ")}` : ""].filter(Boolean);
    status.detail = parts.length ? `พร้อมนำเข้า: ${parts.join(" · ")}` : "ไม่มีข้อมูลใหม่";
    return { status, draft: wb };
  } catch (e) {
    return { status: { ...status, ok: false, detail: "อ่านไม่ได้", error: String(e instanceof Error ? e.message : e).slice(0, 200) }, draft: null };
  }
}

/** The status, and the draft when the sheet was read (a failed read keeps the last draft). */
export async function saveSheetCheck(db: Firestore, check: { status: SheetStatus; draft: RevenueWorkbook | null }, runId = ""): Promise<void> {
  await db.set(SHEET_STATUS, encodeFields({ ...check.status, runId } as unknown as Record<string, unknown>));
  const wb = check.draft;
  if (wb) {
    await db.set(
      SHEET_DRAFT,
      encodeFields({
        readAt: check.status.at,
        overall: clean(wb.overall),
        digital: clean(wb.digital),
        entertainment: clean(wb.entertainment),
        rates: wb.rates,
        unmatchedRates: wb.unmatchedRates,
        sheets: wb.sheets,
      } as unknown as Record<string, unknown>),
    );
  }
}
