"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import type { User } from "@/lib/auth/types";
import { num } from "@/lib/dashboard/format";
import { isStale, type SyncStatus } from "@/lib/sync/status";
import { AlertTriangle, CloudUpload, Loader2 } from "lucide-react";

interface DataStatusProps
  extends Pick<
    DashboardModel,
    "sourceName" | "message" | "filtered" | "reset" | "cloudSaving"
  > {
  currentUser?: User | null;
  onSaveToCloud?: () => Promise<void>;
  /** Admins only: latest sync result, for the warning banner. */
  syncStatus?: SyncStatus | null;
  onOpenSync?: () => void;
}

export function DataStatus({
  sourceName,
  message,
  filtered,
  reset,
  currentUser,
  cloudSaving,
  onSaveToCloud,
  syncStatus,
  onOpenSync,
}: DataStatusProps) {
  const isAdmin = currentUser?.role === "admin";
  const canSaveCloud = isAdmin && sourceName !== "Firebase Firestore" && onSaveToCloud;
  // syncStatus undefined = not loaded yet; null = the sync has never run.
  const syncProblem =
    isAdmin && syncStatus !== undefined
      ? !syncStatus
        ? "ยังไม่มีการ sync อัตโนมัติ"
        : syncStatus.status === "failed"
          ? "Sync รอบล่าสุดล้มเหลว ข้อมูลไม่ถูกแก้ไข"
          : syncStatus.status === "blocked"
            ? "Sync รอบล่าสุดไม่ผ่านการตรวจความถูกต้อง จึงไม่ได้เขียนข้อมูล"
            : isStale(syncStatus)
              ? "ไม่มีการ sync เกิน 26 ชั่วโมง"
              : ""
      : "";

  return (
    <>
      <div className="status-line">
        {/* Data source and last update are in the footer. */}
        <span>ตามตัวกรอง {num(filtered.length)} รายการ</span>
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
      {syncProblem && (
        <div className="sync-banner mobile-hide">
          <AlertTriangle size={16} />
          <span>{syncProblem}</span>
          {onOpenSync && <button onClick={onOpenSync}>ดูสถานะการ Sync</button>}
        </div>
      )}
    </>
  );
}
