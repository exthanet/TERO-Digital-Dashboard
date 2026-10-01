// Opening the dashboard fast (see lib/dashboard/cacheFormat.ts):
// 1. read masterData/meta and dashboardCache/meta (2 small reads);
// 2. if this browser already holds that version → use it (no download);
// 3. else if the compact copy matches the masterData version → download it
//    (~2.5 MB gzipped instead of ~45 MB) and keep it in this browser;
// 4. else (no copy, or out of date) → read masterData as before.
import { Bytes, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db, loadMasterDataWithMetaFromFirebase } from "@/lib/firebase";
import { joinBytes, partId, slimRows, splitBytes } from "@/lib/dashboard/cacheFormat";
import type { RawRow } from "@/lib/dashboard/types";

export interface DashboardLoad {
  rows: RawRow[];
  updatedAt?: string;
  /** Where the rows came from: this browser, the compact copy, or masterData itself. */
  from: "browser" | "cache" | "masterData";
}

// ---------- gzip in the browser ----------

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

// ---------- this browser's copy (IndexedDB, per signed-in device) ----------

const IDB_NAME = "tero-dashboard";
const IDB_STORE = "cache";
const IDB_KEY = "masterRows";

function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // private mode / storage blocked: just skip the browser copy
    }
  });
}

async function idbGet(): Promise<{ version: string; rows: RawRow[] } | null> {
  const base = await idb();
  if (!base) return null;
  return new Promise((resolve) => {
    try {
      const req = base.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as { version: string; rows: RawRow[] }) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(value: { version: string; rows: RawRow[] } | null): Promise<void> {
  const base = await idb();
  if (!base) return;
  await new Promise<void>((resolve) => {
    try {
      const store = base.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE);
      const req = value ? store.put(value, IDB_KEY) : store.delete(IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** On sign-out: no company data stays on a shared computer. */
export function clearDashboardBrowserCache(): Promise<void> {
  return idbSet(null);
}

// ---------- loading ----------

export async function loadDashboardRows(): Promise<DashboardLoad> {
  try {
    const [masterMeta, cacheMeta] = await Promise.all([
      getDoc(doc(db, "masterData", "meta")),
      getDoc(doc(db, "dashboardCache", "meta")),
    ]);
    const version = masterMeta.exists() ? String(masterMeta.data().version || "") : "";
    const updatedAt = masterMeta.exists() ? String(masterMeta.data().updatedAt || "") : undefined;
    const cache = cacheMeta.exists() ? cacheMeta.data() : null;
    if (version && cache && cache.version === version) {
      const local = await idbGet();
      if (local?.version === version && Array.isArray(local.rows)) return { rows: local.rows, updatedAt, from: "browser" };
      const parts: Uint8Array[] = [];
      for (let i = 0; i < Number(cache.parts || 0); i++) {
        const snap = await getDoc(doc(db, "dashboardCache", partId(i)));
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.version !== version) throw new Error("dashboard cache part missing or out of date");
        parts.push((data.data as Bytes).toUint8Array());
      }
      const rows = JSON.parse(await gunzip(joinBytes(parts))) as RawRow[];
      if (rows.length !== Number(cache.rowCount)) throw new Error("dashboard cache row count mismatch");
      void idbSet({ version, rows });
      return { rows, updatedAt, from: "cache" };
    }
  } catch (e) {
    console.warn("dashboard cache not used:", e);
  }
  const full = await loadMasterDataWithMetaFromFirebase();
  return { rows: full.rows, updatedAt: full.updatedAt, from: "masterData" };
}

// ---------- writing (admins, after saving masterData) ----------

/**
 * Write masterData/meta for `version`, then the compact copy. If the copy fails
 * the versions no longer match and the dashboard simply reads masterData.
 */
export async function writeDashboardCache(rows: RawRow[], version: string, updatedAt: string): Promise<void> {
  const previous = await getDoc(doc(db, "dashboardCache", "meta"));
  const oldParts = previous.exists() ? Number(previous.data().parts || 0) : 0;
  await setDoc(doc(db, "masterData", "meta"), { version, updatedAt, rowCount: rows.length });
  const parts = splitBytes(await gzip(JSON.stringify(slimRows(rows))));
  for (let i = 0; i < parts.length; i++) {
    await setDoc(doc(db, "dashboardCache", partId(i)), { version, part: i, data: Bytes.fromUint8Array(parts[i]) });
  }
  await setDoc(doc(db, "dashboardCache", "meta"), {
    version,
    parts: parts.length,
    rowCount: rows.length,
    createdAt: new Date().toISOString(),
  });
  for (let i = parts.length; i < oldParts; i++) await deleteDoc(doc(db, "dashboardCache", partId(i)));
}
