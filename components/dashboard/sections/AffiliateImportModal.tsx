"use client";
// Import Affiliate: the YouTube Studio Shopping exports in Google Sheets
// (AffiliateSheetSettings). The older file upload (affiliateData) was taken out
// with the old report; the Affiliate Dashboard reads affiliateSheets only.
import { BadgeDollarSign, X } from "lucide-react";
import { AffiliateSheetSettings } from "./AffiliateSheetSettings";

interface AffiliateImportModalProps {
  open: boolean;
  onClose: () => void;
  /** After the Google Sheet draft was imported (the dashboard reloads it). */
  onSheetsSaved?: () => void;
}

export function AffiliateImportModal({ open, onClose, onSheetsSaved }: AffiliateImportModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="source-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X />
        </button>
        <div className="modal-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
          <BadgeDollarSign />
        </div>
        <h2>นำเข้าข้อมูล Affiliate Report</h2>
        <p>รายงานจากหน้า Shopping ใน YouTube Studio ที่เก็บไว้ใน Google Sheet · อัปเดต Affiliate Dashboard</p>
        <AffiliateSheetSettings onSaved={onSheetsSaved} />
      </section>
    </div>
  );
}
