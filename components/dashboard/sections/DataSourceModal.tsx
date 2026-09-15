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
      await onSaveToCloud();
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
            <Button onClick={loadSheet} disabled={!sheetUrl || loading || cloudSaving}>
              {loading ? "กำลังโหลด..." : "เชื่อมต่อ Google Sheet"}
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
              onChange={(e) => {
                setFeedback(null);
                onFile(e.target.files?.[0]);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={loading || cloudSaving}
            >
              <Upload />
              อัปโหลดไฟล์ Excel / CSV ใหม่
            </Button>
            <small>
              รองรับไฟล์ Master Data: Date, Program, Topic, Topic_Type, VDO_Type,
              Platform, Views, Engagement และ TV Rating
            </small>

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
