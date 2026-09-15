"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import type { User } from "@/lib/auth/types";
import { dateTimeLabel, num } from "@/lib/dashboard/format";
import { CloudUpload, Loader2 } from "lucide-react";

interface DataStatusProps
  extends Pick<
    DashboardModel,
    "sourceName" | "uploadedAt" | "message" | "filtered" | "reset" | "cloudSaving"
  > {
  currentUser?: User | null;
  onSaveToCloud?: () => Promise<void>;
}

export function DataStatus({
  sourceName,
  uploadedAt,
  message,
  filtered,
  reset,
  currentUser,
  cloudSaving,
  onSaveToCloud,
}: DataStatusProps) {
  const isAdmin = currentUser?.role === "admin";
  const canSaveCloud = isAdmin && sourceName !== "Firebase Firestore" && onSaveToCloud;

  return (
    <>
      <div className="status-line">
        <span>
          แหล่งข้อมูล: <strong>{sourceName}</strong>
        </span>
        <span>{num(filtered.length)} รายการ</span>
        <span>
          อัปโหลดล่าสุด: <strong>{dateTimeLabel(uploadedAt)} น.</strong>
        </span>
        {canSaveCloud && (
          <button
            onClick={onSaveToCloud}
            disabled={cloudSaving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "3px 9px",
              fontSize: 12,
              fontWeight: 600,
              cursor: cloudSaving ? "not-allowed" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            {cloudSaving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CloudUpload size={13} />
                บันทึกขึ้น Cloud
              </>
            )}
          </button>
        )}
        {message && <span className="status-message">{message}</span>}
        <button onClick={reset}>ล้างตัวกรอง</button>
      </div>
    </>
  );
}
