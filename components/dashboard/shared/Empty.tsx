import { CircleGauge } from "lucide-react";

export function Empty({
  text = "ยังไม่มีข้อมูลสำหรับตัวกรองนี้",
}: {
  text?: string;
}) {
  return (
    <div className="empty-state">
      <CircleGauge />
      <span>{text}</span>
    </div>
  );
}
