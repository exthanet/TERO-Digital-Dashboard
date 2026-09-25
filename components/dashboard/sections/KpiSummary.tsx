"use client";
import { Kpi } from "@/components/dashboard/shared/Kpi";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, num, pct } from "@/lib/dashboard/format";
import { Activity, BarChart3, Globe2, Sparkles, Tv, Upload } from "lucide-react";
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
      {/* แถวที่ 1: Reach & Viewership (ยอดวิวรวมทั้งหมด, Digital Views, TV Audience, TV Rating) */}
      <section
        className="kpi-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 10,
        }}
      >
        <Kpi
          tone="indigo"
          icon={<Globe2 />}
          label="ยอดวิวรวมทั้งหมด (TV + Digital)"
          value={compact(metrics.totalCombinedViews)}
          detail={
            <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "#4338ca" }}>
                  Digital: {compact(metrics.digitalViews)}
                </span>
                <span style={{ color: "#94a3b8" }}>·</span>
                <span style={{ fontWeight: 600, color: "#0284c7" }}>
                  TV: {compact(metrics.tvAudience)}
                </span>
              </span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                รวมสื่อโทรทัศน์และออนไลน์ทุกแพลตฟอร์ม
              </span>
            </span>
          }
        />
        <Kpi
          tone="blue"
          icon={<Activity />}
          label={
            tvMode ? "TV Audience ตามช่วงเวลา" : "ยอดวิวรวม (Digital Only)"
          }
          value={compact(metrics.views)}
          detail={
            tvMode ? (
              `ONE31 + GMM25 · เฉลี่ย ${compact(metrics.avgDaily)} คน/วัน`
            ) : (
              <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  {metrics.digitalViewsByPlatform && metrics.digitalViewsByPlatform.length > 0 ? (
                    metrics.digitalViewsByPlatform.map((x, idx) => (
                      <span key={x.name} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontWeight: 600, color: "#0369a1" }}>
                          {x.name}: {compact(x.total)}
                        </span>
                        {idx < metrics.digitalViewsByPlatform.length - 1 && (
                          <span style={{ color: "#94a3b8" }}>·</span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span>ไม่รวม TV Audience</span>
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
                  <span>
                    เฉลี่ย {compact(metrics.avgDaily)} วิว/วัน · รวม {num(performanceFiltered.length)} คอนเทนต์
                  </span>
                  {metrics.digitalContentByPlatform && metrics.digitalContentByPlatform.length > 1 && (
                    <span style={{ color: "#94a3b8" }}>
                      ({metrics.digitalContentByPlatform.map((c) => `${c.name} ${num(c.total)}`).join(", ")})
                    </span>
                  )}
                </span>
              </span>
            )
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
          value={
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: "#1d4ed8", fontSize: "1.15em", fontWeight: 700 }}>
                {metrics.ratingAvgOne31 > 0 ? metrics.ratingAvgOne31.toFixed(3) : "-"}
              </span>
              <span style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 500 }}>
                (One31)
              </span>
              <span style={{ color: "#cbd5e1" }}>/</span>
              <span style={{ color: "#d97706", fontSize: "1.15em", fontWeight: 700 }}>
                {metrics.ratingAvgGmm25 > 0 ? metrics.ratingAvgGmm25.toFixed(3) : "-"}
              </span>
              <span style={{ fontSize: "0.75em", color: "#64748b", fontWeight: 500 }}>
                (GMM25)
              </span>
            </span>
          }
          detail={
            <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "#1d4ed8" }}>
                  One31: {num(metrics.one31Episodes)} ตอน
                </span>
                <span style={{ color: "#94a3b8" }}>·</span>
                <span style={{ fontWeight: 600, color: "#d97706" }}>
                  GMM25: {num(metrics.gmm25Episodes)} ตอน
                </span>
              </span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                เรตติ้งเฉลี่ยเฉพาะแต่ละช่องโทรทัศน์
              </span>
            </span>
          }
        />
      </section>

      {/* แถวที่ 2: Engagement & Content Production (Engagement รวม, Engagement Rate, Total Upload) */}
      <section
        className="kpi-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 12,
        }}
      >
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
          detail={
            <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {metrics.uploadByPlatform && metrics.uploadByPlatform.length > 0 ? (
                  metrics.uploadByPlatform.map((x, idx) => (
                    <span key={x.name} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontWeight: 600, color: "#c2410c" }}>
                        {x.name} {num(x.total)}
                      </span>
                      {idx < metrics.uploadByPlatform.length - 1 && (
                        <span style={{ color: "#94a3b8" }}>·</span>
                      )}
                    </span>
                  ))
                ) : (
                  "ไม่มีข้อมูล"
                )}
              </span>

              {metrics.latestDate && metrics.latestUploadByPlatform && metrics.latestUploadByPlatform.length > 0 && (
                <span style={{ fontSize: 11, color: "#ea580c", display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>
                    ล่าสุด ({metrics.latestDate}):
                  </span>
                  <span>
                    {metrics.latestUploadByPlatform.map((p) => `${p.name} ${num(p.total)}`).join(" · ")}
                  </span>
                  <span style={{ color: "#9a3412", fontWeight: 600 }}>
                    (รวม {num(metrics.latestUploads)} คลิป)
                  </span>
                </span>
              )}
            </span>
          }
        />
      </section>
    </>
  );
}
