// Reads accMonthly/* (written by the sync, admins only) for รายได้ → Monthly ACC.
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AccMonth } from "@/lib/dashboard/accMonthly";

/** Every month stored, newest first; empty before the first sync wrote one. */
export async function loadAccMonths(): Promise<AccMonth[]> {
  const snap = await getDocs(collection(db, "accMonthly"));
  return snap.docs
    .map((d) => d.data() as AccMonth)
    .filter((m) => m.month && Array.isArray(m.rows))
    .sort((a, b) => b.month.localeCompare(a.month));
}
