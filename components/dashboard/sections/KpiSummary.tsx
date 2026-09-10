"use client";
import { Kpi } from "@/components/dashboard/shared/Kpi";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, num, pct } from "@/lib/dashboard/format";
import { Activity, BarChart3, Sparkles, Tv, Upload } from "lucide-react";
export function KpiSummary({
  tvMode,
  performanceFiltered,
  metrics,
  types,
}: Pick<
  DashboardModel,
  "tvMode" | "performanceFiltered" | "metrics" | "types"
>) {
  return (
    <>
      <section className="kpi-grid">
        <Kpi
          tone="blue"
          icon={<Activity />}
          label={
            tvMode ? "TV Audience ตามช่วงเวลา" : "ยอดวิวรวม (Digital Only)"
          }
          value={compact(metrics.views)}
          detail={
            tvMode
              ? `ONE31 + GMM25 · เฉลี่ย ${compact(metrics.avgDaily)} คน/วัน`
              : `ไม่รวม TV Audience · เฉลี่ย ${compact(metrics.avgDaily)} ต่อวัน`
          }
        />
        <Kpi
          tone="green"
          icon={<BarChart3 />}
          label="Engagement รวม"
          value={compact(metrics.engagement)}
          detail={`${pct(metrics.engagementRate)} Engagement Rate`}
        />
        <Kpi
          tone="violet"
          icon={<Sparkles />}
          label="Engagement Rate"
          value={pct(metrics.engagementRate)}
          detail={
            tvMode
              ? "TV ไม่มี Social Engagement"
              : "Likes + Comments + Shares ÷ Digital Views"
          }
        />
        <Kpi
          tone="orange"
          icon={<Upload />}
          label="Total Upload"
          value={num(metrics.uploads)}
          detail={metrics.uploadByPlatform
            .map((x) => `${x.name} ${num(x.total)}`)
            .join(" · ") || "ไม่มีข้อมูล"
          }
        />
        <Kpi
          tone="sky"
          icon={<Tv />}
          label="TV Audience รวม"
          value={compact(metrics.tvAudience)}
          detail={`${num(metrics.tvEpisodes)} ตอน · เฉลี่ย ${compact(metrics.tvAudienceAvg)} คน/ตอน`}
        />
        <Kpi
          tone="sky"
          icon={<Tv />}
          label="TV Rating (Average)"
          value={metrics.ratingAvg.toFixed(3)}
          detail="คะแนนจริง · ไม่คูณ 700,000"
        />
      </section>
    </>
  );
}
