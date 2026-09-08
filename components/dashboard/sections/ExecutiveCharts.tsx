"use client";
import { ViewPie } from "@/components/dashboard/charts/ViewPie";
import { Empty } from "@/components/dashboard/shared/Empty";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, dateLabel, num } from "@/lib/dashboard/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function ExecutiveCharts({
  executiveChartType,
  setExecutiveChartType,
  executiveGrain,
  digitalVsTv,
  programPie,
  platformPie,
  vdoTypePie,
}: Pick<
  DashboardModel,
  | "executiveChartType"
  | "setExecutiveChartType"
  | "executiveGrain"
  | "digitalVsTv"
  | "programPie"
  | "platformPie"
  | "vdoTypePie"
>) {
  return (
    <>
      <section className="executive-view-grid">
        <article className="panel executive-line">
          <div className="panel-head">
            <div>
              <h2>Digital Platform Views vs TV Audience</h2>
              <p>
                เทียบแนวโน้มทุกแพลตฟอร์ม ·{" "}
                {executiveGrain === "day" ? "รายวัน" : "รายเดือน"} · ไม่คูณ TV
                Rating
              </p>
            </div>
            <div className="segmented chart-type-toggle">
              <button
                className={executiveChartType === "line" ? "active" : ""}
                onClick={() => setExecutiveChartType("line")}
              >
                กราฟเส้น
              </button>
              <button
                className={executiveChartType === "bar" ? "active" : ""}
                onClick={() => setExecutiveChartType("bar")}
              >
                กราฟแท่ง
              </button>
            </div>
          </div>
          <div className="chart-lg">
            {digitalVsTv.length ? (
              <ResponsiveContainer>
                {executiveChartType === "line" ? (
                  <LineChart data={digitalVsTv}>
                    <CartesianGrid vertical={false} stroke="#e8edf5" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) =>
                        executiveGrain === "day" ? dateLabel(v) : v
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => num(Number(v))}
                      labelFormatter={(v) =>
                        executiveGrain === "day"
                          ? dateLabel(String(v))
                          : String(v)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Digital Views"
                      stroke="#0757e8"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="TV Audience"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={digitalVsTv}>
                    <CartesianGrid vertical={false} stroke="#e8edf5" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) =>
                        executiveGrain === "day" ? dateLabel(v) : v
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => num(Number(v))}
                      labelFormatter={(v) =>
                        executiveGrain === "day"
                          ? dateLabel(String(v))
                          : String(v)
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="Digital Views"
                      fill="#0757e8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="TV Audience"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </article>
        <div className="executive-pies">
          <ViewPie
            title="รายการทั้งหมด"
            subtitle="สัดส่วนยอดวิวตาม Program"
            data={programPie}
          />
          <ViewPie
            title="Cross Platform"
            subtitle="สัดส่วน Views / TV Audience"
            data={platformPie}
          />
          <ViewPie
            title="VDO Type"
            subtitle="สัดส่วนยอดวิวตามรูปแบบวิดีโอ"
            data={vdoTypePie}
          />
        </div>
      </section>
    </>
  );
}
