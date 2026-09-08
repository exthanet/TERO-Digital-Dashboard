"use client";
import type { DashboardModel } from "@/hooks/useDashboard";

export function LoadingOverlay({ loading }: Pick<DashboardModel, "loading">) {
  return (
    <>
      {loading && (
        <div className="loading-overlay">
          <div className="loader" />
          <span>กำลังประมวลผลข้อมูล...</span>
        </div>
      )}
    </>
  );
}
