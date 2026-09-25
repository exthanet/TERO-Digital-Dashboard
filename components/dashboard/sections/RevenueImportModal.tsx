"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MonthlyRevenueItem,
  RevenueData,
  parseYouTubeRevenueFile,
} from "@/lib/dashboard/revenueParser";
import { saveRevenueDataToFirebase } from "@/lib/firebase";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface RevenueImportModalProps {
  open: boolean;
  onClose: () => void;
  currentData: RevenueData | null;
  onDataUpdated: (newData: RevenueData) => void;
  isAdmin?: boolean;
}

const moneyUsd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v || 0);

export function RevenueImportModal({
  open,
  onClose,
  currentData,
  onDataUpdated,
  isAdmin = true,
}: RevenueImportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    monthsCount: number;
    totalRevenue: number;
    newData: RevenueData;
  } | null>(null);

  const [importMode, setImportMode] = useState<"overwrite" | "merge">("overwrite");
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
      const parsedItems = await parseYouTubeRevenueFile(file);
      if (parsedItems.length === 0) {
        throw new Error("ไม่พบข้อมูลรายได้รายเดือนในไฟล์");
      }

      let finalMonthly: MonthlyRevenueItem[] = [];

      if (importMode === "overwrite") {
        // Replace all existing records completely with the new file
        finalMonthly = [...parsedItems].sort((a, b) => a.month.localeCompare(b.month));
      } else {
        // Merge with existing data
        const monthMap = new Map<string, MonthlyRevenueItem>();
        (currentData?.monthly || []).forEach((m) => monthMap.set(m.month, m));
        parsedItems.forEach((m) => monthMap.set(m.month, m));
        finalMonthly = Array.from(monthMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month)
        );
      }

      const totalRevenue = finalMonthly.reduce((acc, curr) => acc + curr.estRevenue, 0);

      const newData: RevenueData = {
        generatedAt: new Date().toISOString(),
        monthly: finalMonthly,
      };

      setParsedPreview({
        monthsCount: parsedItems.length,
        totalRevenue,
        newData,
      });

      setFeedback({
        type: "success",
        text: `อ่านไฟล์ "${file.name}" สำเร็จ! (${importMode === "overwrite" ? "แทนที่ข้อมูลทั้งหมดด้วย" : "ตรวจพบ"} ${parsedItems.length} เดือน)`,
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
      await saveRevenueDataToFirebase(parsedPreview.newData, (curr, total) => {
        setProgress({ current: curr, total });
      });

      onDataUpdated(parsedPreview.newData);
      setFeedback({
        type: "success",
        text: `บันทึกข้อมูล YouTube Revenue ขึ้น Firebase สำเร็จเรียบร้อย!`,
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

        <div className="modal-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
          <BadgeDollarSign />
        </div>

        <h2>นำเข้าข้อมูล Revenue Report (YouTube)</h2>
        <p>
          อัปโหลดไฟล์รายงานรายได้รายเดือนของ YouTube (.xlsx / .csv / Tab Delimited)
          เพื่ออัปเดตและบันทึกข้อมูลขึ้นระบบ Cloud (Firebase)
        </p>

        {/* Import Mode Selection */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setImportMode("overwrite")}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: importMode === "overwrite" ? "#fff" : "transparent",
              color: importMode === "overwrite" ? "#2563eb" : "#64748b",
              boxShadow: importMode === "overwrite" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            🔄 ลบข้อมูลเก่าและแทนที่ทั้งหมด (Overwrite)
          </button>
          <button
            type="button"
            onClick={() => setImportMode("merge")}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: importMode === "merge" ? "#fff" : "transparent",
              color: importMode === "merge" ? "#2563eb" : "#64748b",
              boxShadow: importMode === "merge" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            ➕ อัปเดตผสานข้อมูลเดิม (Merge)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
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
            marginTop: 12,
          }}
        >
          {isProcessing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 className="animate-spin" size={20} color="#2563eb" />
              <span>กำลังประมวลผลไฟล์...</span>
            </div>
          ) : (
            <>
              <div style={{ margin: "0 auto", color: "#2563eb" }}>
                <Upload size={28} />
              </div>
              <strong style={{ fontSize: 14 }}>คลิกเพื่อเลือกไฟล์ Excel / CSV / TSV</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                คอลัมน์ที่รองรับ: Monthly, EST.Revenue, Estimated partner ad revenue, YouTube Premium, Affiliate program, Shorts Feed ads ฯลฯ
              </span>
            </>
          )}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 12,
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
              marginTop: 12,
              padding: 14,
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#1e40af", fontSize: 14 }}>
                สรุปข้อมูลที่ตรวจพบ ({parsedPreview.monthsCount} เดือน)
              </strong>
              <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 700 }}>
                {moneyUsd(parsedPreview.totalRevenue)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#334155" }}>
              รวมยอดสะสมทั้งหมดในระบบหลังอัปเดต: {parsedPreview.newData.monthly.length} เดือน
            </div>

            <Button
              onClick={handleSaveToCloud}
              disabled={cloudSaving || !isAdmin}
              style={{
                marginTop: 6,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
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
