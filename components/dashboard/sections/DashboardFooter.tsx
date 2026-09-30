"use client";
import { dateTimeLabel, num } from "@/lib/dashboard/format";

export function DashboardFooter({
  sourceName,
  uploadedAt,
  totalRows,
}: {
  sourceName: string;
  uploadedAt: string;
  totalRows: number;
}) {
  return (
    <footer>
      <span>Executive Performance Dashboard</span>
      <span>
        แหล่งข้อมูล: <strong>{sourceName}</strong> · {num(totalRows)} รายการ · ข้อมูลอัปเดตล่าสุด:{" "}
        <strong>{uploadedAt ? `${dateTimeLabel(uploadedAt)} น.` : "-"}</strong>
      </span>
      <span>Digital Views แยกจาก TV Rating · Metricool อาจล่าช้า 2–3 วัน</span>
    </footer>
  );
}
