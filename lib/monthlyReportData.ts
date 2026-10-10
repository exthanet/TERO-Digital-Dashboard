// รายงานประจำเดือน in Firestore: monthlyReports/{YYYY-MM} holds one month's
// frozen numbers (lib/dashboard/monthlyReport.ts). Read with the monthlyReport
// permission, written by admins only (firestore.rules); saving again replaces it.
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { REPORT_VERSION, type MonthlyReport } from "@/lib/dashboard/monthlyReport";
import type { ReportLayout } from "@/lib/dashboard/reportLayout";

export interface SavedReport {
  month: string;
  report: MonthlyReport;
  savedAt: string;
  savedByName: string;
  /** Admin's page order, hidden pages and texts (lib/dashboard/reportLayout.ts). */
  layout?: ReportLayout;
}

function isComplete(r: MonthlyReport | undefined, month: string): r is MonthlyReport {
  return !!r && r.month === month && Number.isInteger(r.version) && r.version >= 1 && r.version <= REPORT_VERSION && typeof r.prevMonth === "string" && !!r.online && !!r.onlinePrev
    && [r.platforms, r.formats, r.programs, r.topClips, r.topics, r.hashtags, r.slots, r.tvChannels, r.competitors, r.recommendations].every(Array.isArray);
}

/** Every saved report, newest month first. */
export async function listMonthlyReports(): Promise<SavedReport[]> {
  const snap = await getDocs(collection(db, "monthlyReports"));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const at = x.savedAt instanceof Timestamp ? x.savedAt.toDate().toISOString() : String(x.savedAt || "");
      return { month: d.id, report: x.report as MonthlyReport, savedAt: at, savedByName: String(x.savedByName || ""), layout: (x.layout as ReportLayout | undefined) || undefined };
    })
    // Only complete reports of a version this page can draw; anything else is left out, never shown half.
    .filter((r) => isComplete(r.report, r.month))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Freeze (or replace) a month's report. */
export async function saveMonthlyReport(report: MonthlyReport, savedByName: string, layout?: ReportLayout): Promise<void> {
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
    // Remaking a month keeps the admin's page order and texts.
    ...(layout ? { layout: JSON.parse(JSON.stringify(layout)) } : {}),
  });
}

/** Save only the page order, hidden pages and texts of a saved month (the numbers stay as they are). */
export async function saveReportLayout(month: string, layout: ReportLayout, editorName: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("ต้องเข้าสู่ระบบก่อน");
  await setDoc(
    doc(db, "monthlyReports", month),
    {
      month,
      // firestore.rules: every admin write names its writer and time.
      savedBy: uid,
      savedAt: serverTimestamp(),
      layout: JSON.parse(JSON.stringify({ ...layout, editedByName: editorName, editedAt: new Date().toISOString() })),
    },
    // Replace the whole layout (a deep merge would keep texts the admin cleared).
    { mergeFields: ["month", "savedBy", "savedAt", "layout"] },
  );
}
