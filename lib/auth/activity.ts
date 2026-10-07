// Who uses the dashboard, for admins (จัดการผู้ใช้ → การใช้งาน):
//   visits/{uid}_{day}   one per person per Bangkok day the dashboard was opened,
//                        signed in fresh or still signed in (Microsoft keeps people signed in)
//   downloads/{auto}     every file taken from the dashboard (CSV / Excel / backup link)
// Each person writes only their own entries; only admins read them (firestore.rules).
// Never blocks the page: a failed write is ignored.
import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, setDoc, updateDoc, where, Timestamp, limit } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { User } from "./types";

export const bangkokDay = (d = new Date()) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);

const toIso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === "string" ? v : "");

/** "microsoft" or "password": how this session signed in. */
async function methodOf(u: FirebaseUser): Promise<string> {
  try {
    const p = (await u.getIdTokenResult()).signInProvider;
    return p === "microsoft.com" ? "microsoft" : p || "";
  } catch {
    return "";
  }
}

const recorded = new Set<string>();

/** Once per page load and person: today's visit (created, or its last time and count moved on). */
export async function recordVisit(profile: User, fbUser: FirebaseUser): Promise<void> {
  const day = bangkokDay();
  const id = `${fbUser.uid}_${day}`;
  if (recorded.has(id)) return;
  recorded.add(id);
  try {
    const ref = doc(db, "visits", id);
    const method = await methodOf(fbUser);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { lastAt: serverTimestamp(), opens: increment(1), ...(method ? { method } : {}) });
    } else {
      await setDoc(ref, { uid: fbUser.uid, email: profile.email, name: profile.name, day, method, firstAt: serverTimestamp(), lastAt: serverTimestamp(), opens: 1 });
    }
  } catch {
    recorded.delete(id);
  }
}

/** A file taken from the dashboard. `kind`: what it is ("csv-performance", "acc-excel", ...). */
export function recordDownload(kind: string, file: string, rows?: number): void {
  const u = auth.currentUser;
  if (!u) return;
  void addDoc(collection(db, "downloads"), {
    uid: u.uid,
    email: u.email ?? "",
    name: u.displayName ?? "",
    kind,
    file,
    rows: rows ?? null,
    at: serverTimestamp(),
  }).catch(() => undefined);
}

export interface Visit {
  uid: string;
  email: string;
  name: string;
  day: string;
  method: string;
  firstAt: string;
  lastAt: string;
  opens: number;
}

export interface Download {
  id: string;
  uid: string;
  email: string;
  name: string;
  kind: string;
  file: string;
  rows: number | null;
  at: string;
}

/** Visits from `fromDay` ("YYYY-MM-DD") on (admins). */
export async function listVisits(fromDay: string): Promise<Visit[]> {
  const snap = await getDocs(query(collection(db, "visits"), where("day", ">=", fromDay)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { uid: String(x.uid), email: String(x.email ?? ""), name: String(x.name ?? ""), day: String(x.day), method: String(x.method ?? ""), firstAt: toIso(x.firstAt), lastAt: toIso(x.lastAt), opens: Number(x.opens) || 0 };
  });
}

/** Downloads since `since`, newest first (admins). */
export async function listDownloads(since: Date, max = 200): Promise<Download[]> {
  const snap = await getDocs(query(collection(db, "downloads"), where("at", ">=", Timestamp.fromDate(since)), orderBy("at", "desc"), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, uid: String(x.uid), email: String(x.email ?? ""), name: String(x.name ?? ""), kind: String(x.kind ?? ""), file: String(x.file ?? ""), rows: typeof x.rows === "number" ? x.rows : null, at: toIso(x.at) };
  });
}

/** Per person over the visits: days, opens, last visit, how they sign in. */
export function usageByPerson(visits: Visit[]): Map<string, { days: number; opens: number; last: string; methods: Set<string> }> {
  const m = new Map<string, { days: number; opens: number; last: string; methods: Set<string> }>();
  for (const v of visits) {
    const x = m.get(v.uid) || { days: 0, opens: 0, last: "", methods: new Set<string>() };
    x.days++;
    x.opens += v.opens;
    if ((v.lastAt || v.day) > x.last) x.last = v.lastAt || v.day;
    if (v.method) x.methods.add(v.method);
    m.set(v.uid, x);
  }
  return m;
}
