// Reading what the daily sync wrote (see lib/integrations/syncWriter.ts).
// syncStatus/latest: every signed-in user. syncRuns: admins (firestore.rules).
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FetchStat } from "@/lib/sync/sourceMatrix";
import type { RevenueWorkbook } from "@/lib/dashboard/revenueParser";

export type SyncState = "success" | "blocked" | "failed";

export interface PlatformStatus {
  ok: boolean;
  latestPost: string;
  error?: string;
}

export interface TvSourceStatus {
  id: string;
  name: string;
  ok: boolean;
  episodes?: number;
  pending?: number;
  cancelled?: number;
  competitors?: number;
  error?: string;
  /** Where the numbers came from: "link" (sharing link), "sharepoint" (Graph), "upload" (admin upload) or "file". */
  from?: string;
}

export interface SyncStatus {
  runId: string;
  status: SyncState;
  finishedAt: string;
  lastSuccessAt: string;
  message: string;
  platforms: Record<string, PlatformStatus>;
  tvSources?: TvSourceStatus[];
  /** Optional sources beside the platforms (e.g. YouTube Analytics). */
  integrations?: Record<string, { ok: boolean; detail: string; error?: string }>;
  /** Last email notification attempt. */
  notify?: { ok: boolean; at: string; to: number; error?: string };
}

export interface SyncCheck {
  name: string;
  pass: boolean;
  detail: string;
  warnings?: string[];
}

export interface SyncRun extends Omit<SyncStatus, "lastSuccessAt"> {
  trigger: "schedule" | "manual" | "local";
  startedAt: string;
  window: { since: string; until: string };
  totals: Record<string, number>;
  checks: SyncCheck[];
  /** TV this run: air days of new episodes, episodes updated, latest air day with a rating. */
  tv?: { inserted: string[]; updated: number; latest: string };
  /** What each brand and network was read from (scripts/metricool-sync.mjs fetchStats). */
  sources?: FetchStat[];
  backupId?: string;
  githubRunUrl?: string;
}

/** Where admins start a run by hand (GitHub Actions → Run workflow). */
export const SYNC_WORKFLOW_URL = "https://github.com/exthanet/TERO-Digital-Dashboard/actions/workflows/data-sync.yml";

/** The daily run starts 05:17 Bangkok (22:17 UTC); GitHub may start it later. */
export function nextScheduledRun(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(22, 17, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** No finished run for this long means the schedule did not run. */
export const STALE_HOURS = 26;

export function isStale(status: SyncStatus | null, now = new Date()): boolean {
  if (!status?.finishedAt) return true;
  return now.getTime() - Date.parse(status.finishedAt) > STALE_HOURS * 3600000;
}

export async function loadSyncStatus(): Promise<SyncStatus | null> {
  const snap = await getDoc(doc(db, "syncStatus", "latest"));
  return snap.exists() ? (snap.data() as SyncStatus) : null;
}

export async function loadSyncRuns(count = 30): Promise<SyncRun[]> {
  const snap = await getDocs(query(collection(db, "syncRuns"), orderBy("startedAt", "desc"), limit(count)));
  return snap.docs.map((d) => d.data() as SyncRun);
}

// ---------- Backups in GitHub (written by the workflow, admins read) ----------

/** One daily backup artifact (scripts/backup-record.mjs); GitHub deletes the file after 90 days. */
export interface BackupEntry {
  id: string;
  createdAt: string;
  expiresAt: string;
  artifactUrl: string;
  runUrl: string;
  syncOutcome: string;
  sizeBytes: number;
  masterDataRows: number;
  files: string[];
}

export async function loadBackups(count = 90): Promise<BackupEntry[]> {
  const snap = await getDocs(query(collection(db, "backups"), orderBy("createdAt", "desc"), limit(count)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BackupEntry, "id">) }));
}

// ---------- TV workbook sources (admins edit, the sync reads) ----------

export interface TvSourceConfig {
  id: string;
  name: string;
  url: string;
  sheet: string;
  channel: "One31" | "GMM25";
  program: string;
  enabled: boolean;
}

export async function loadTvSources(): Promise<TvSourceConfig[]> {
  const snap = await getDoc(doc(db, "syncConfig", "tvSources"));
  return snap.exists() ? ((snap.data().sources || []) as TvSourceConfig[]) : [];
}

export async function saveTvSources(sources: TvSourceConfig[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, "syncConfig", "tvSources"), { sources, updatedAt: new Date().toISOString(), updatedBy });
}

// ---------- Revenue Google Sheet (admins set the link, the sync reads it daily) ----------

export interface RevenueSheetConfig {
  url: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** What the last sync did with the sheet, and which account the sheet must be shared with. */
export interface RevenueSheetStatus {
  at: string;
  ok: boolean;
  detail: string;
  error: string;
  shareWith: string;
  /** Months new to the system / with other numbers than stored, when the sheet was read. */
  added?: string[];
  changed?: string[];
}

/** The sheet as last read (lib/integrations/revenueSheet.ts saveSheetCheck), for the import preview. */
export type RevenueSheetDraft = RevenueWorkbook & { readAt: string };

export async function loadRevenueSheet(): Promise<{ config: RevenueSheetConfig | null; status: RevenueSheetStatus | null; draft: RevenueSheetDraft | null }> {
  const [c, s, d] = await Promise.all(["revenueSheet", "revenueSheetStatus", "revenueSheetDraft"].map((id) => getDoc(doc(db, "syncConfig", id))));
  return {
    config: c.exists() ? (c.data() as RevenueSheetConfig) : null,
    status: s.exists() ? (s.data() as RevenueSheetStatus) : null,
    draft: d.exists() ? (d.data() as RevenueSheetDraft) : null,
  };
}

export async function saveRevenueSheet(url: string, updatedBy: string): Promise<void> {
  await setDoc(doc(db, "syncConfig", "revenueSheet"), { url, updatedAt: new Date().toISOString(), updatedBy });
}

// ---------- Affiliate Google Sheets (admins set the links, the sync reads them into a draft) ----------

/** One link as the sync last read it (lib/integrations/affiliateSheetsSync.ts). */
export interface AffiliateLinkStatus {
  url: string;
  ok: boolean;
  kind?: string;
  month?: string;
  from?: string;
  to?: string;
  rows?: number;
  error?: string;
}
export interface AffiliateSheetsStatus extends Omit<RevenueSheetStatus, "added" | "changed"> {
  links: AffiliateLinkStatus[];
}

export async function loadAffiliateSheetSettings(): Promise<{ links: string[]; status: AffiliateSheetsStatus | null }> {
  const [c, s] = await Promise.all(["affiliateSheets", "affiliateSheetsStatus"].map((id) => getDoc(doc(db, "syncConfig", id))));
  return { links: c.exists() ? ((c.data().links || []) as string[]) : [], status: s.exists() ? (s.data() as AffiliateSheetsStatus) : null };
}

export async function saveAffiliateSheetLinks(links: string[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, "syncConfig", "affiliateSheets"), { links, updatedAt: new Date().toISOString(), updatedBy });
}

// ---------- TV workbook uploaded by an admin (read by the next sync) ----------

export interface TvUploadDoc {
  sourceId: string;
  name: string;
  sheet: string;
  channel: "One31" | "GMM25";
  program: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  episodes: Record<string, unknown>[];
  competitors: Record<string, unknown>[];
  pending: string[];
  cancelled: string[];
}

export async function saveTvUpload(upload: TvUploadDoc): Promise<void> {
  await setDoc(doc(db, "tvUploads", upload.sourceId), upload);
}

export async function loadTvUploadInfo(): Promise<Record<string, { fileName: string; uploadedAt: string; uploadedBy: string; episodes: number }>> {
  const snap = await getDocs(collection(db, "tvUploads"));
  return Object.fromEntries(
    snap.docs.map((d) => {
      const x = d.data() as TvUploadDoc;
      return [d.id, { fileName: x.fileName, uploadedAt: x.uploadedAt, uploadedBy: x.uploadedBy, episodes: x.episodes?.length || 0 }];
    }),
  );
}

// ---------- Email notifications after each sync ----------

export type NotifyMode = "always" | "problems" | "off";

export interface NotificationConfig {
  emails: string[];
  mode: NotifyMode;
}

export async function loadNotificationConfig(): Promise<NotificationConfig> {
  const snap = await getDoc(doc(db, "syncConfig", "notifications"));
  const d = snap.exists() ? snap.data() : {};
  return { emails: (d.emails as string[]) || [], mode: (d.mode as NotifyMode) || "always" };
}

export async function saveNotificationConfig(config: NotificationConfig, updatedBy: string): Promise<void> {
  await setDoc(doc(db, "syncConfig", "notifications"), { ...config, updatedAt: new Date().toISOString(), updatedBy });
}
