"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { Sparkles } from "lucide-react";
export function ExecutiveInsights({
  insights,
}: Pick<DashboardModel, "insights">) {
  return (
    <>
      <section className="insight-strip">
        <div className="insight-title">
          <Sparkles />
          <div>
            <strong>Executive Insights</strong>
            <span>เหตุผลที่คอนเทนต์ทำผลงานดี</span>
          </div>
        </div>
        {insights.map((x, i) => (
          <p key={i}>
            <b>{i + 1}</b>
            {x}
          </p>
        ))}
      </section>
    </>
  );
}
