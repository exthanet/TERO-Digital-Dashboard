// รายงานประจำเดือน in Firestore: monthlyReports/{YYYY-MM} holds one month's
// frozen numbers (lib/dashboard/monthlyReport.ts). Read with the monthlyReport
// permission, written by admins only (firestore.rules); saving again replaces it.
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { REPORT_VERSION, type MonthlyReport } from "@/lib/dashboard/monthlyReport";

export interface SavedReport {
  month: string;
  report: MonthlyReport;
  savedAt: string;
  savedByName: string;
}

function isComplete(r: MonthlyReport | undefined, month: string): r is MonthlyReport {
  return !!r && r.month === month && r.version === REPORT_VERSION && typeof r.prevMonth === "string" && !!r.online && !!r.onlinePrev
    && [r.platforms, r.formats, r.programs, r.topClips, r.topics, r.hashtags, r.slots, r.tvChannels, r.competitors, r.recommendations].every(Array.isArray);
}

/** Every saved report, newest month first. */
export async function listMonthlyReports(): Promise<SavedReport[]> {
  const snap = await getDocs(collection(db, "monthlyReports"));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const at = x.savedAt instanceof Timestamp ? x.savedAt.toDate().toISOString() : String(x.savedAt || "");
      return { month: d.id, report: x.report as MonthlyReport, savedAt: at, savedByName: String(x.savedByName || "") };
    })
    // Only complete reports of a version this page can draw; anything else is left out, never shown half.
    .filter((r) => isComplete(r.report, r.month))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Freeze (or replace) a month's report. */
export async function saveMonthlyReport(report: MonthlyReport, savedByName: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("ต้องเข้าสู่ระบบก่อน");
  // Firestore keeps no `undefined`: a JSON round trip leaves plain values only.
  const plain = JSON.parse(JSON.stringify(report)) as MonthlyReport;
  await setDoc(doc(db, "monthlyReports", report.month), {
    month: report.month,
    report: plain,
    savedBy: uid,
    savedByName,
    savedAt: serverTimestamp(),
  });
}
