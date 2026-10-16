"use client";
// Affiliate Program Report: the Affiliate Dashboard from the YouTube Studio
// Shopping exports kept in Google Sheets (lib/dashboard/affiliateSheets.ts),
// imported by an admin on Import Affiliate. The older file-based report
// (affiliateData) is no longer shown; its Firestore documents are left as they are.
import { useEffect, useState } from "react";
import { BadgeDollarSign, Upload } from "lucide-react";
import { isStaticHost } from "@/lib/dashboard/hosting";
import { loadAffiliateSheets } from "@/lib/firebase";
import type { AffiliateSheets } from "@/lib/dashboard/affiliateSheets";
import type { User } from "@/lib/auth/types";
import { AffiliateDashboard } from "@/components/dashboard/sections/AffiliateDashboard";
import { AffiliateImportModal } from "@/components/dashboard/sections/AffiliateImportModal";
import { track } from "@/lib/loadingBar";

interface AffiliateReportProps {
  currentUser?: User | null;
}

export default function AffiliateReport({ currentUser }: AffiliateReportProps) {
  const [sheets, setSheets] = useState<(AffiliateSheets & { readAt?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const isAdmin = currentUser?.role === "admin";

  const load = () => {
    if (isStaticHost) return setLoading(false);
    setLoading(true);
    void track(loadAffiliateSheets())
      .then(setSheets)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const importButton = isAdmin ? (
    <button type="button" className="mobile-hide aff2-import" onClick={() => setImportOpen(true)}>
      <Upload size={15} />
      Import Affiliate Report
    </button>
  ) : undefined;

  return (
    <section className="affiliate-report" id="affiliate">
      {sheets && sheets.monthly?.length > 0 ? (
        <AffiliateDashboard data={sheets} actions={importButton} />
      ) : (
        <div className="empty-state aff2-empty">
          <BadgeDollarSign size={36} color="#94a3b8" />
          <span>{loading ? "กำลังโหลดข้อมูล Affiliate…" : "ยังไม่มีข้อมูล Affiliate ในระบบ"}</span>
          {!loading && importButton}
        </div>
      )}

      <AffiliateImportModal open={importOpen && isAdmin} onClose={() => setImportOpen(false)} onSheetsSaved={load} />
    </section>
  );
}
