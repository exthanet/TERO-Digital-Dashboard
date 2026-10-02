"use client";
import { ViewPie } from "@/components/dashboard/charts/ViewPie";
import { Empty } from "@/components/dashboard/shared/Empty";
import type { DashboardModel } from "@/hooks/useDashboard";
import { PLATFORM_COLORS, TOPIC_COLORS } from "@/lib/dashboard/constants";
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

const TV_COLOR = "#f59e0b";

type Series = { key: string; color: string; stack?: string };

/** One trend chart (line or bar) with the period axis shared by both charts here. */
function TrendChart({
  data,
  series,
  type,
  grain,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  type: "line" | "bar";
  grain: "day" | "month";
}) {
  if (!data.length || !series.length) return <Empty />;
  const xAxis = (
    <XAxis dataKey="date" tickFormatter={(v) => (grain === "day" ? dateLabel(v) : v)} tick={{ fontSize: 11 }} />
  );
  const tooltip = (
    <Tooltip
      formatter={(v) => num(Number(v))}
      labelFormatter={(v) => (grain === "day" ? dateLabel(String(v)) : String(v))}
    />
  );
  return (
    <ResponsiveContainer>
      {type === "line" ? (
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#e8edf5" />
          {xAxis}
          <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
          {tooltip}
          <Legend />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.key === "TV Audience" ? 3 : 2.2}
              strokeDasharray={s.key === "TV Audience" ? "6 3" : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#e8edf5" />
          {xAxis}
          <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
          {tooltip}
          <Legend />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} stackId={s.stack} radius={s.stack ? undefined : [4, 4, 0, 0]} />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}

export function ExecutiveCharts({
  executiveChartType,
  setExecutiveChartType,
  executiveGrain,
  digitalVsTv,
  digitalPlatforms,
  vdoTypeTrend,
  programPie,
  platformPie,
  vdoTypePie,
}: Pick<
  DashboardModel,
  | "executiveChartType"
  | "setExecutiveChartType"
  | "executiveGrain"
  | "digitalVsTv"
  | "digitalPlatforms"
  | "vdoTypeTrend"
  | "programPie"
  | "platformPie"
  | "vdoTypePie"
>) {
  const grainText = executiveGrain === "day" ? "รายวัน" : "รายเดือน";
  // Bars: digital platforms stack into one column beside TV; lines: one per platform.
  const platformSeries: Series[] = [
    ...digitalPlatforms.map((p) => ({ key: p, color: PLATFORM_COLORS[p] || "#64748b", stack: "digital" })),
    { key: "TV Audience", color: TV_COLOR },
  ];
  const vdoSeries: Series[] = vdoTypeTrend.keys.map((k, i) => ({
    key: k,
    color: k === "อื่นๆ" ? "#94a3b8" : TOPIC_COLORS[i % TOPIC_COLORS.length],
    stack: "vdo",
  }));
  const toggle = (
    <div className="segmented chart-type-toggle">
      <button className={executiveChartType === "line" ? "active" : ""} onClick={() => setExecutiveChartType("line")}>
        กราฟเส้น
      </button>
      <button className={executiveChartType === "bar" ? "active" : ""} onClick={() => setExecutiveChartType("bar")}>
        กราฟแท่ง
      </button>
    </div>
  );

  return (
    <section className="executive-view-grid executive-paired">
      <article className="panel executive-line">
        <div className="panel-head">
          <div>
            <h2>Digital Platform Views vs TV Audience</h2>
            <p>แยกแต่ละแพลตฟอร์มเทียบผู้ชมทีวี · {grainText} · ไม่คูณ TV Rating</p>
          </div>
          {toggle}
        </div>
        <div className="chart-lg">
          <TrendChart data={digitalVsTv} series={platformSeries} type={executiveChartType} grain={executiveGrain} />
        </div>
      </article>
      {/* Phones skip the pies: each repeats a panel further down */}
      <div className="mobile-hide executive-side">
        <ViewPie
          title="Cross Platform"
          subtitle="สัดส่วน Views / TV Audience"
          data={platformPie}
          colors={{ ...PLATFORM_COLORS, TV: TV_COLOR }}
        />
      </div>

      <article className="panel executive-line">
        <div className="panel-head">
          <div>
            <h2>VDO Type</h2>
            <p>ยอดวิวแยกรูปแบบวิดีโอ · {grainText} · ทีวีนับผู้ชม</p>
          </div>
          {toggle}
        </div>
        <div className="chart-lg">
          <TrendChart data={vdoTypeTrend.data} series={vdoSeries} type={executiveChartType} grain={executiveGrain} />
        </div>
      </article>
      <div className="mobile-hide executive-side">
        <ViewPie title="VDO Type" subtitle="สัดส่วนยอดวิวตามรูปแบบวิดีโอ" data={vdoTypePie} />
      </div>

      <div className="mobile-hide executive-side">
        <ViewPie title="รายการทั้งหมด" subtitle="สัดส่วนยอดวิวตาม Program" data={programPie} />
      </div>
    </section>
  );
}
