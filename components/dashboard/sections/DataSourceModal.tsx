"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/hooks/useDashboard";
import type { User } from "@/lib/auth/types";
import { num } from "@/lib/dashboard/format";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudUpload,
  FileSpreadsheet,
  Lock,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface DataSourceModalProps
  extends Pick<
    DashboardModel,
    | "loading"
    | "sourceOpen"
    | "setSourceOpen"
    | "sheetUrl"
    | "setSheetUrl"
    | "fileRef"
    | "loadSheet"
    | "onFile"
    | "sourceName"
    | "cloudSaving"
    | "cloudSaveProgress"
  > {
  currentUser?: User | null;
  rowsCount: number;
  onSaveToCloud: () => Promise<void>;
}

export function DataSourceModal({
  loading,
  sourceOpen,
  setSourceOpen,
  sheetUrl,
  setSheetUrl,
  fileRef,
  loadSheet,
  onFile,
  sourceName,
  rowsCount,
  cloudSaving,
  cloudSaveProgress,
  onSaveToCloud,
  currentUser,
}: DataSourceModalProps) {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isAdmin = currentUser?.role === "admin";

  const handleCloudSave = async () => {
    setFeedback(null);
    try {
      const res = await onSaveToCloud();
      setFeedback({
        type: "success",
        text: `บันทึกข้อมูล ${num(rowsCount)} แถวเข้าสู่ Firebase Firestore สำเร็จ!`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก",
      });
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFeedback(null);
    setIsProcessing(true);
    try {
      const res = await onFile(file);
      if (res && !res.success) {
        setFeedback({ type: "error", text: res.message });
      } else if (res && res.success) {
        setFeedback({ type: "success", text: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "นำเข้าไฟล์ไม่สำเร็จ",
      });
    } finally {
      setIsProcessing(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const handleSheetLoad = async () => {
    setFeedback(null);
    setIsProcessing(true);
    try {
      const res = await loadSheet();
      if (res && !res.success) {
        setFeedback({ type: "error", text: res.message });
      } else if (res && res.success) {
        setFeedback({ type: "success", text: res.message });
      }
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "เชื่อมต่อ Google Sheet ไม่สำเร็จ",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {sourceOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSourceOpen(false)}
        >
          <section
            className="source-modal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <button className="close" onClick={() => setSourceOpen(false)}>
              <X />
            </button>
            <div className="modal-icon">
              <FileSpreadsheet />
            </div>
            <h2>เชื่อมต่อและอัปเดตข้อมูล</h2>
            <p>
              นำเข้า Master Data ผ่าน Google Sheets หรือไฟล์ Excel / CSV
              เพื่อแสดงผลในแดชบอร์ด
            </p>

            {/* Google Sheets input */}
            <label>
              <span>Google Sheets URL</span>
              <Input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </label>
            <Button
              onClick={handleSheetLoad}
              disabled={!sheetUrl || loading || isProcessing || cloudSaving}
            >
              {loading || isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  กำลังโหลดข้อมูล...
                </>
              ) : (
                "เชื่อมต่อ Google Sheet"
              )}
            </Button>

            <div className="divider">
              <span>หรือ</span>
            </div>

            {/* File upload */}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div
              onClick={() => !loading && !isProcessing && !cloudSaving && fileRef.current?.click()}
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: 12,
                padding: "20px 16px",
                textAlign: "center",
                cursor: loading || isProcessing || cloudSaving ? "not-allowed" : "pointer",
                background: "#f8fafc",
                transition: "all 0.2s",
                display: "grid",
                placeContent: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  color: "#334155",
                }}
              >
                {isProcessing || loading ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <Upload size={22} />
                )}
              </div>
              <strong style={{ fontSize: 14 }}>
                {isProcessing ? "กำลังอ่านไฟล์..." : "คลิกเพื่อเลือกไฟล์ Master Data (.xlsx, .csv)"}
              </strong>
              <small style={{ color: "#64748b" }}>
                รองรับไฟล์ Master Data ที่มีคอลัมน์ Date, Program, Topic, Platform, Views ฯลฯ
              </small>
            </div>

            {/* Cloud Sync Section */}
            <div
              style={{
                marginTop: 12,
                padding: "14px 16px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Cloud size={18} color="#0284c7" />
                  <strong style={{ fontSize: 14 }}>
                    บันทึกข้อมูลขึ้น Cloud (Firebase)
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    background: "#edf2f7",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {num(rowsCount)} รายการ
                </span>
              </div>

              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                แหล่งข้อมูลปัจจุบัน: <strong>{sourceName}</strong>
              </div>

              {feedback && (
                <div
                  style={{
                    padding: "8px 12px",
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
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              {isAdmin ? (
                <Button
                  onClick={handleCloudSave}
                  disabled={cloudSaving || rowsCount === 0}
                  style={{
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#fff",
                    fontWeight: 600,
                    gap: 8,
                    height: 40,
                  }}
                >
                  {cloudSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังบันทึกขึ้น Cloud...{" "}
                      {cloudSaveProgress
                        ? `(${cloudSaveProgress.current}/${cloudSaveProgress.total})`
                        : ""}
                    </>
                  ) : (
                    <>
                      <CloudUpload size={16} />
                      บันทึกข้อมูลขึ้น Cloud (Firebase Firestore)
                    </>
                  )}
                </Button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "#94a3b8",
                    background: "#f1f5f9",
                    padding: "8px 12px",
                    borderRadius: 8,
                  }}
                >
                  <Lock size={14} />
                  <span>
                    เฉพาะสิทธิ์ <strong>Admin</strong>{" "}
                    เท่านั้นที่สามารถบันทึกข้อมูลขึ้น Cloud ได้ (สิทธิ์ของคุณ:{" "}
                    {currentUser?.role || "ทั่วไป"})
                  </span>
                </div>
              )}

              <small style={{ fontSize: 11, color: "#94a3b8" }}>
                * เมื่อบันทึกสำเร็จ ข้อมูลจะถูกจัดเก็บถาวรใน Firebase Firestore
                และทุกคนที่เข้าชมแดชบอร์ดจะเห็นข้อมูลใหม่ทันที
              </small>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
