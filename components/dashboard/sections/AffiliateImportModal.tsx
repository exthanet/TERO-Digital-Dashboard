"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AffiliateData,
  parseAffiliateFile,
  mergeAffiliateData,
} from "@/lib/dashboard/affiliateParser";
import { saveAffiliateDataToFirebase } from "@/lib/firebase";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface AffiliateImportModalProps {
  open: boolean;
  onClose: () => void;
  currentData: AffiliateData | null;
  onDataUpdated: (newData: AffiliateData) => void;
  isAdmin?: boolean;
}

export function AffiliateImportModal({
  open,
  onClose,
  currentData,
  onDataUpdated,
  isAdmin = true,
}: AffiliateImportModalProps) {
  const currentYearNum = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [parsedPreview, setParsedPreview] = useState<{
    year: number;
    contentsCount: number;
    productsCount: number;
    dailyCount: number;
    revenue: number;
    newData: AffiliateData;
  } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setIsProcessing(true);
    setFeedback(null);
    setParsedPreview(null);

    try {
      const parsed = await parseAffiliateFile(file, selectedYear);
      const merged = mergeAffiliateData(
        currentData,
        selectedYear,
        parsed.contents,
        parsed.products,
        parsed.daily,
        parsed.officialSummary
      );

      const targetSummary = merged.summary.find((s) => s.year === selectedYear);
      const revenue = targetSummary?.affiliateRevenue || 0;

      setParsedPreview({
        year: selectedYear,
        contentsCount: parsed.contents.length,
        productsCount: parsed.products.length,
        dailyCount: parsed.daily.length,
        revenue,
        newData: merged,
      });

      setFeedback({
        type: "success",
        text: `อ่านไฟล์ "${file.name}" สำเร็จ! ตรวจพบข้อมูลปี ${selectedYear}`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "ไม่สามารถอ่านไฟล์ได้ โปรดตรวจสอบรูปแบบไฟล์",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (!parsedPreview) return;
    setCloudSaving(true);
    setFeedback(null);
    setProgress(null);

    try {
      await saveAffiliateDataToFirebase(parsedPreview.newData, (curr, total) => {
        setProgress({ current: curr, total });
      });

      onDataUpdated(parsedPreview.newData);
      setFeedback({
        type: "success",
        text: `บันทึกข้อมูล Affiliate ปี ${parsedPreview.year} ขึ้น Firebase สำเร็จเรียบร้อย!`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกขึ้น Firebase",
      });
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="source-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <button className="close" onClick={onClose}>
          <X />
        </button>

        <div className="modal-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
          <BadgeDollarSign />
        </div>

        <h2>นำเข้าข้อมูล Affiliate Report</h2>
        <p>
          อัปโหลดไฟล์รายงาน Affiliate (.xlsx / .csv) เช่น รายงานจาก YouTube Shopping
          เพื่ออัปเดตและบันทึกข้อมูลขึ้นระบบ Cloud (Firebase)
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 4 }}>
          <label>
            <span style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, display: "block" }}>
              เลือกปีข้อมูลของไฟล์นี้
            </span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                background: "#fff",
              }}
            >
              {[currentYearNum - 1, currentYearNum, currentYearNum + 1].map((y) => (
                <option key={y} value={y}>
                  ปี {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />

        <div
          onClick={() => !isProcessing && !cloudSaving && fileInputRef.current?.click()}
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: 12,
            padding: "24px 16px",
            textAlign: "center",
            cursor: isProcessing || cloudSaving ? "not-allowed" : "pointer",
            background: "#f8fafc",
            transition: "all 0.2s",
            display: "grid",
            placeContent: "center",
            gap: 8,
          }}
        >
          {isProcessing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 className="animate-spin" size={20} color="#059669" />
              <span>กำลังประมวลผลไฟล์...</span>
            </div>
          ) : (
            <>
              <div style={{ margin: "0 auto", color: "#059669" }}>
                <Upload size={28} />
              </div>
              <strong style={{ fontSize: 14 }}>คลิกเพื่อเลือกไฟล์ Excel / CSV</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                รองรับไฟล์ Content Performance หรือ Product Performance
              </span>
            </>
          )}
        </div>

        {feedback && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
              color: feedback.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {parsedPreview && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#166534", fontSize: 14 }}>
                สรุปข้อมูลปี {parsedPreview.year} พร้อมบันทึก
              </strong>
              <span style={{ fontSize: 12, color: "#15803d", fontWeight: 700 }}>
                Revenue: ฿{parsedPreview.revenue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#334155", display: "flex", gap: 16 }}>
              <span>📹 Content: {parsedPreview.contentsCount} รายการ</span>
              <span>🛍️ Product: {parsedPreview.productsCount} รายการ</span>
              <span>📅 Daily: {parsedPreview.dailyCount} วัน</span>
            </div>

            <Button
              onClick={handleSaveToCloud}
              disabled={cloudSaving || !isAdmin}
              style={{
                marginTop: 6,
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#fff",
                fontWeight: 600,
                height: 42,
                gap: 8,
              }}
            >
              {cloudSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  กำลังบันทึกข้อมูลขึ้น Firebase...{" "}
                  {progress ? `(${progress.current}/${progress.total})` : ""}
                </>
              ) : (
                <>
                  <CloudUpload size={18} />
                  บันทึกข้อมูลขึ้น Cloud (Firebase)
                </>
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
