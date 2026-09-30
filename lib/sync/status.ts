// Reading what the daily sync wrote (see lib/integrations/syncWriter.ts).
// syncStatus/latest: every signed-in user. syncRuns: admins (firestore.rules).
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  /** Where the numbers came from: "upload" (admin upload) or "sharepoint". */
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
  backupId?: string;
  githubRunUrl?: string;
}

/** Where admins start a run by hand (GitHub Actions → Run workflow). */
export const SYNC_WORKFLOW_URL = "https://github.com/exthanet/TERO-Digital-Dashboard/actions/workflows/data-sync.yml";

/** The daily run starts 06:00 Bangkok (23:00 UTC). */
export function nextScheduledRun(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(23, 0, 0, 0);
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
