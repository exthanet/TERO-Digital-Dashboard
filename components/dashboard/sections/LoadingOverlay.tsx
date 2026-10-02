"use client";
// Full-screen loading: on opening, the step the app is really on (sign-in check,
// fetching from the system, preparing rows); other loads show a single line.
import { Check } from "lucide-react";
import type { LoadingStage } from "@/hooks/useDashboard";

const STEPS: { stage: LoadingStage; label: string }[] = [
  { stage: "auth", label: "ตรวจสอบการเข้าสู่ระบบ" },
  { stage: "fetch", label: "โหลดข้อมูลจากระบบ" },
  { stage: "process", label: "ประมวลผล" },
];

export function LoadingOverlay({ loading, stage = null }: { loading: boolean; stage?: LoadingStage | null }) {
  if (!loading) return null;
  const current = STEPS.findIndex((s) => s.stage === stage);
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-run" aria-hidden="true">
          <i />
        </div>
        {current < 0 ? (
          <span className="loading-title">กำลังประมวลผลข้อมูล...</span>
        ) : (
          <ol className="loading-steps">
            {STEPS.map((s, i) => (
              <li key={s.stage} className={i < current ? "done" : i === current ? "active" : ""}>
                <span className="loading-dot">{i < current ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
