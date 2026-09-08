"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { dateTimeLabel, num } from "@/lib/dashboard/format";
export function DataStatus({
  sourceName,
  uploadedAt,
  message,
  filtered,
  reset,
}: Pick<
  DashboardModel,
  "sourceName" | "uploadedAt" | "message" | "filtered" | "reset"
>) {
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
        {message && <span className="status-message">{message}</span>}
        <button onClick={reset}>ล้างตัวกรอง</button>
      </div>
    </>
  );
}
