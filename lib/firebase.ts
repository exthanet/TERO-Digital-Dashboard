import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
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

/** Firestore collection `masterData`: one document per dashboard row. */
export async function loadMasterDataFromFirebase(): Promise<RawRow[]> {
  const snapshot = await getDocs(collection(db, "masterData"));
  return snapshot.docs.map((item) => item.data() as RawRow);
}
