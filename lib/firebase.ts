import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import type { RawRow } from "@/lib/dashboard/types";

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

/** Firestore collection `masterData`: one document per dashboard row or chunked documents. */
export async function loadMasterDataFromFirebase(): Promise<RawRow[]> {
  const snapshot = await getDocs(collection(db, "masterData"));
  if (snapshot.empty) return [];
  const rows: RawRow[] = [];
  snapshot.docs.forEach((item) => {
    const data = item.data();
    if (Array.isArray(data.rows)) {
      rows.push(...(data.rows as RawRow[]));
    } else {
      rows.push(data as RawRow);
    }
  });
  return rows;
}

function cleanRowForFirestore(row: RawRow): Record<string, unknown> {
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

  const CHUNK_SIZE = 500;
  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

  // 1. Fetch existing chunks to track any leftover chunks
  const existingSnap = await getDocs(collection(db, "masterData"));
  const existingChunkIds = new Set<string>();
  existingSnap.docs.forEach((docItem) => {
    if (docItem.id.startsWith("chunk_")) existingChunkIds.add(docItem.id);
  });

  // 2. Upload chunks sequentially or in small batches
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, rows.length);
    const chunkRows = rows.slice(start, end).map(cleanRowForFirestore);
    const docId = `chunk_${String(i).padStart(3, "0")}`;
    existingChunkIds.delete(docId);

    const docRef = doc(db, "masterData", docId);
    await setDoc(docRef, {
      adminToken: ADMIN_WRITE_TOKEN,
      chunkIndex: i,
      rowCount: chunkRows.length,
      updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
      rows: [],
    });
  }

  return {
    success: true,
    message: `บันทึกข้อมูล ${rows.length.toLocaleString()} แถวขึ้น Firebase Firestore เรียบร้อยแล้ว`,
    totalChunks,
  };
}
