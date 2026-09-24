import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import type { RawRow } from "@/lib/dashboard/types";
import type { AffiliateData } from "@/lib/dashboard/affiliateParser";

const firebaseConfig = {
  apiKey: "AIzaSyAryjQuJ7dujmHxoXtiCNFANjt5bkE3PAc",
  authDomain: "entertainment-dashboard-733e5.firebaseapp.com",
  projectId: "entertainment-dashboard-733e5",
  storageBucket: "entertainment-dashboard-733e5.firebasestorage.app",
  messagingSenderId: "109531742990",
  appId: "1:109531742990:web:d88bddbbacae0d40a10d5f",
  measurementId: "G-FLXQES7H7C",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutFirebase = () => signOut(auth);

export const ADMIN_WRITE_TOKEN = "tero-admin-2026-secure";

export interface MasterDataResult {
  rows: RawRow[];
  updatedAt?: string;
}

/** Firestore collection `masterData`: one document per dashboard row or chunked documents. */
export async function loadMasterDataWithMetaFromFirebase(): Promise<MasterDataResult> {
  const snapshot = await getDocs(collection(db, "masterData"));
  if (snapshot.empty) return { rows: [] };
  const rows: RawRow[] = [];
  let latestUpdatedAt: string | undefined;

  snapshot.docs.forEach((item) => {
    const data = item.data();
    if (data.updatedAt && (!latestUpdatedAt || String(data.updatedAt) > latestUpdatedAt)) {
      latestUpdatedAt = String(data.updatedAt);
    }
    if (Array.isArray(data.rows)) {
      rows.push(...(data.rows as RawRow[]));
    } else if (item.id.startsWith("chunk_") || !item.id.startsWith("meta")) {
      rows.push(data as RawRow);
    }
  });

  return {
    rows,
    updatedAt: latestUpdatedAt,
  };
}

export async function loadMasterDataFromFirebase(): Promise<RawRow[]> {
  const result = await loadMasterDataWithMetaFromFirebase();
  return result.rows;
}

function cleanRowForFirestore(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    cleaned[key] = value === undefined ? null : value;
  }
  return cleaned;
}

/**
 * Save rows to Firestore `masterData` collection partitioned in chunks.
 * Only succeeds if adminToken matches the security rule.
 */
export async function saveMasterDataToFirebase(
  rows: RawRow[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; message: string; totalChunks: number }> {
  if (!rows || rows.length === 0) {
    throw new Error("ไม่มีข้อมูลสำหรับบันทึก");
  }

  // Firestore doc limit is 1MB. 250 rows is ~250KB, ensuring zero payload failures.
  const CHUNK_SIZE = 250;
  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

  // 1. Fetch existing chunks to track any leftover chunks
  const existingSnap = await getDocs(collection(db, "masterData"));
  const existingChunkIds = new Set<string>();
  existingSnap.docs.forEach((docItem) => {
    if (docItem.id.startsWith("chunk_")) existingChunkIds.add(docItem.id);
  });

  const now = new Date().toISOString();

  // 2. Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, rows.length);
    const chunkRows = rows.slice(start, end).map((r) => cleanRowForFirestore(r as Record<string, unknown>));
    const docId = `chunk_${String(i).padStart(3, "0")}`;
    existingChunkIds.delete(docId);

    const docRef = doc(db, "masterData", docId);
    await setDoc(docRef, {
      adminToken: ADMIN_WRITE_TOKEN,
      chunkIndex: i,
      rowCount: chunkRows.length,
      updatedAt: now,
      rows: chunkRows,
    });

    if (onProgress) {
      onProgress(i + 1, totalChunks);
    }
  }

  // 3. Clear any obsolete leftover chunk docs from previous runs
  for (const obsoleteId of existingChunkIds) {
    const docRef = doc(db, "masterData", obsoleteId);
    await setDoc(docRef, {
      adminToken: ADMIN_WRITE_TOKEN,
      chunkIndex: -1,
      rowCount: 0,
      updatedAt: now,
      rows: [],
    });
  }

  return {
    success: true,
    message: `บันทึกข้อมูล ${rows.length.toLocaleString()} แถวขึ้น Firebase Firestore เรียบร้อยแล้ว`,
    totalChunks,
  };
}

/**
 * Load Affiliate data from Firestore `affiliateData` collection
 */
export async function loadAffiliateDataFromFirebase(): Promise<AffiliateData | null> {
  const snapshot = await getDocs(collection(db, "affiliateData"));
  if (snapshot.empty) return null;

  const summaryDoc = snapshot.docs.find((d) => d.id === "summary");
  const metaDoc = snapshot.docs.find((d) => d.id === "meta");

  const summary = summaryDoc?.data()?.summary || [];
  const generatedAt = metaDoc?.data()?.generatedAt || new Date().toISOString();

  const contents: AffiliateData["contents"] = [];
  const products: AffiliateData["products"] = [];
  const daily: AffiliateData["daily"] = [];

  snapshot.docs.forEach((item) => {
    const data = item.data();
    if (item.id.startsWith("content_") && Array.isArray(data.rows)) {
      contents.push(...data.rows);
    } else if (item.id.startsWith("product_") && Array.isArray(data.rows)) {
      products.push(...data.rows);
    } else if (item.id.startsWith("daily_") && Array.isArray(data.rows)) {
      daily.push(...data.rows);
    }
  });

  if (summary.length === 0 && contents.length === 0 && daily.length === 0) {
    return null;
  }

  return {
    generatedAt,
    summary,
    contents,
    products,
    daily,
  };
}

/**
 * Save Affiliate data to Firestore `affiliateData` collection
 */
export async function saveAffiliateDataToFirebase(
  data: AffiliateData,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; message: string }> {
  const CHUNK_SIZE = 400;

  const contentChunks: AffiliateData["contents"][] = [];
  for (let i = 0; i < data.contents.length; i += CHUNK_SIZE) {
    contentChunks.push(data.contents.slice(i, i + CHUNK_SIZE));
  }

  const productChunks: AffiliateData["products"][] = [];
  for (let i = 0; i < data.products.length; i += CHUNK_SIZE) {
    productChunks.push(data.products.slice(i, i + CHUNK_SIZE));
  }

  const dailyChunks: AffiliateData["daily"][] = [];
  for (let i = 0; i < data.daily.length; i += CHUNK_SIZE) {
    dailyChunks.push(data.daily.slice(i, i + CHUNK_SIZE));
  }

  const totalSteps =
    2 + contentChunks.length + productChunks.length + dailyChunks.length;
  let currentStep = 0;

  // 1. Save Meta doc
  await setDoc(doc(db, "affiliateData", "meta"), {
    adminToken: ADMIN_WRITE_TOKEN,
    generatedAt: data.generatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  currentStep++;
  if (onProgress) onProgress(currentStep, totalSteps);

  // 2. Save Summary doc
  await setDoc(doc(db, "affiliateData", "summary"), {
    adminToken: ADMIN_WRITE_TOKEN,
    summary: data.summary.map((s) => cleanRowForFirestore(s as Record<string, unknown>)),
    updatedAt: new Date().toISOString(),
  });
  currentStep++;
  if (onProgress) onProgress(currentStep, totalSteps);

  // 3. Save Content chunks
  for (let i = 0; i < contentChunks.length; i++) {
    const docId = `content_${String(i).padStart(3, "0")}`;
    await setDoc(doc(db, "affiliateData", docId), {
      adminToken: ADMIN_WRITE_TOKEN,
      index: i,
      rows: contentChunks[i].map((r) => cleanRowForFirestore(r as Record<string, unknown>)),
      updatedAt: new Date().toISOString(),
    });
    currentStep++;
    if (onProgress) onProgress(currentStep, totalSteps);
  }

  // 4. Save Product chunks
  for (let i = 0; i < productChunks.length; i++) {
    const docId = `product_${String(i).padStart(3, "0")}`;
    await setDoc(doc(db, "affiliateData", docId), {
      adminToken: ADMIN_WRITE_TOKEN,
      index: i,
      rows: productChunks[i].map((r) => cleanRowForFirestore(r as Record<string, unknown>)),
      updatedAt: new Date().toISOString(),
    });
    currentStep++;
    if (onProgress) onProgress(currentStep, totalSteps);
  }

  // 5. Save Daily chunks
  for (let i = 0; i < dailyChunks.length; i++) {
    const docId = `daily_${String(i).padStart(3, "0")}`;
    await setDoc(doc(db, "affiliateData", docId), {
      adminToken: ADMIN_WRITE_TOKEN,
      index: i,
      rows: dailyChunks[i].map((r) => cleanRowForFirestore(r as Record<string, unknown>)),
      updatedAt: new Date().toISOString(),
    });
    currentStep++;
    if (onProgress) onProgress(currentStep, totalSteps);
  }

  return {
    success: true,
    message: "บันทึกข้อมูล Affiliate ขึ้น Firebase เรียบร้อยแล้ว",
  };
}
