// Affiliate from the YouTube Studio exports in Google Sheets: the links are set in
// Import Affiliate (syncConfig/affiliateSheets). Only the "revenue-sheet" run,
// started by an admin (not the daily sync), reads them into a draft
// (affiliateSheetsDraft/*) and says what is new; an admin checks it on Import
// Affiliate and saves it to affiliateSheets/*. The sheets stay private: they are
// shared with the sync's service account as Viewer.
//
// Relative imports only: the sync runs this file directly with Node.
import * as XLSX from "xlsx";
import { diffAffiliate, joinFromStore, mergeAffiliate, readAffiliateSheets, splitForStore, type AffiliateSheets, type AffiliateStoreMain, type AffiliateStoreMonth, type SheetTabs } from "../dashboard/affiliateSheets.ts";
import { decodeFields, docId, encodeFields, getAccessToken, type Firestore, type ServiceAccount } from "./firestoreRest.ts";
import { DRIVE_SCOPE, downloadSheet, sheetIdOf } from "./revenueSheet.ts";

export const AFF_CONFIG = "syncConfig/affiliateSheets";
export const AFF_STATUS = "syncConfig/affiliateSheetsStatus";
export const AFF_DRAFT = "affiliateSheetsDraft";
export const AFF_STORE = "affiliateSheets";

export interface AffLinkStatus {
  url: string;
  ok: boolean;
  kind?: string;
  month?: string;
  from?: string;
  to?: string;
  rows?: number;
  /** Product exports: "revenue" (commission, sales, orders) or "clicks" (clicks, impressions). */
  metrics?: string;
  error?: string;
}
export interface AffSheetStatus {
  at: string;
  ok: boolean;
  detail: string;
  error: string;
  shareWith: string;
  links: AffLinkStatus[];
}

const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const th = (m: string) => `${TH[Number(m.slice(5, 7)) - 1] || m} ${m.slice(2, 4)}`;
/** "ก.ย. 26", or "ม.ค. 26 – ต.ค. 26 (10 เดือน)" for a long list. */
const thList = (ms: string[]) => (ms.length > 3 ? `${th(ms[0])} – ${th(ms[ms.length - 1])} (${ms.length} เดือน)` : ms.map(th).join(", "));

export function tabsOf(buf: ArrayBuffer): SheetTabs {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  return Object.fromEntries(wb.SheetNames.map((s) => [s, XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[s], { defval: null, raw: true })]));
}

/** What is stored now, put back together (null when nothing is). */
export async function loadStored(db: Firestore, collection = AFF_STORE): Promise<AffiliateSheets | null> {
  const docs = await db.listRaw(collection);
  const main = docs.find((d) => docId(d.name) === "current");
  if (!main) return null;
  const months = docs.filter((d) => docId(d.name).startsWith("m_")).map((d) => decodeFields(d.fields || {}) as unknown as AffiliateStoreMonth);
  return joinFromStore(decodeFields(main.fields || {}) as unknown as AffiliateStoreMain, months);
}

/** Read every link and compare with what is stored. Nothing is written here. */
export async function checkAffiliateSheets(db: Firestore, sa: ServiceAccount | null, fetcher: typeof fetch = fetch): Promise<{ status: AffSheetStatus; draft: (AffiliateSheets & { readAt: string }) | null }> {
  const at = new Date().toISOString();
  const status: AffSheetStatus = { at, ok: true, detail: "ยังไม่ได้ตั้งลิงก์", error: "", shareWith: sa?.client_email || "", links: [] };
  const cfg = await db.get(AFF_CONFIG);
  const links = cfg ? ((decodeFields(cfg.fields || {}).links as string[] | undefined) || []).filter(Boolean) : [];
  if (!links.length) return { status, draft: null };
  if (!sa) return { status: { ...status, ok: false, detail: "อ่านไม่ได้", error: "no service account" }, draft: null };
  const token = await getAccessToken(sa, DRIVE_SCOPE);
  const books: SheetTabs[] = [];
  for (const url of links) {
    const id = sheetIdOf(url);
    if (!id) {
      status.links.push({ url, ok: false, error: "ลิงก์ไม่ใช่ Google Sheet" });
      continue;
    }
    try {
      const tabs = tabsOf(await downloadSheet(id, token, fetcher));
      books.push(tabs);
      const src = readAffiliateSheets([tabs]).sources[0];
      status.links.push({ url, ok: src.kind !== "unknown", kind: src.kind, rows: src.rows, ...(src.month ? { month: src.month } : {}), ...(src.from ? { from: src.from, to: src.to } : {}), ...(src.metrics ? { metrics: src.metrics } : {}), ...(src.kind === "unknown" ? { error: "ไม่รู้จักรูปแบบไฟล์ (ต้องเป็น export จากหน้า Shopping)" } : {}) });
    } catch (e) {
      status.links.push({ url, ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 160) });
    }
  }
  const bad = status.links.filter((l) => !l.ok);
  if (!books.length) return { status: { ...status, ok: false, detail: "อ่านไม่ได้", error: bad[0]?.error || "" }, draft: null };
  const draft = { ...readAffiliateSheets(books), readAt: at };
  // Imported as Merge: months the links no longer carry stay as they are.
  const stored = await loadStored(db);
  const d = diffAffiliate(stored, mergeAffiliate(stored, draft));
  const parts = [d.added.length ? `ใหม่ ${thList(d.added)}` : "", d.changed.length ? `อัปเดต ${thList(d.changed)}` : "", d.longChanged ? "ไฟล์รวมเปลี่ยน" : ""].filter(Boolean);
  status.detail = parts.length ? `พร้อมนำเข้า: ${parts.join(" · ")}` : "ไม่มีข้อมูลใหม่";
  if (bad.length) {
    status.ok = false;
    status.error = `อ่านไม่ได้ ${bad.length} ลิงก์`;
  }
  return { status, draft };
}

/** The status, and the draft when something was read (a failed read keeps the last draft). */
export async function saveAffiliateCheck(db: Firestore, check: { status: AffSheetStatus; draft: (AffiliateSheets & { readAt: string }) | null }, runId = ""): Promise<void> {
  await db.set(AFF_STATUS, encodeFields({ ...check.status, runId } as unknown as Record<string, unknown>));
  if (!check.draft) return;
  const { main, months } = splitForStore(check.draft);
  const keep = new Set(["current", ...months.map((m) => `m_${m.month}`)]);
  for (const m of months) await db.set(`${AFF_DRAFT}/m_${m.month}`, encodeFields(m as unknown as Record<string, unknown>));
  await db.set(`${AFF_DRAFT}/current`, encodeFields(main as unknown as Record<string, unknown>));
  for (const name of await db.listNames(AFF_DRAFT)) {
    const id = name.split("/").pop() || "";
    if (!keep.has(id)) await db.delete(`${AFF_DRAFT}/${id}`);
  }
}
