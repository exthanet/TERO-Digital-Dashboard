"use client";
import { PerformanceTooltip } from "@/components/dashboard/charts/PerformanceTooltip";
import { TvAudienceTooltip } from "@/components/dashboard/charts/TvAudienceTooltip";
import { Empty } from "@/components/dashboard/shared/Empty";
import TvRatingChoropleth from "@/components/dashboard/TvRatingChoropleth";
import type { DashboardModel } from "@/hooks/useDashboard";
import { sumBy } from "@/lib/dashboard/analytics";
import {
  PLATFORM_COLORS,
  TOPIC_COLORS,
  TYPE_COLORS,
} from "@/lib/dashboard/constants";
import { compact, dateLabel, num, pct } from "@/lib/dashboard/format";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function PerformanceSections({
  vdoType,
  topVdoType,
  setTopVdoType,
  grain,
  setGrain,
  options,
  digitalFiltered,
  tvMode,
  performanceValue,
  metrics,
  chartGrain,
  daily,
  types,
  topics,
  platforms,
  programs,
  top,
  best,
  provinceRating,
  rating,
  ratingGrain,
  setRatingGrain,
  tvAudience,
  tvRatingBreakdown,
  download,
}: Pick<
  DashboardModel,
  | "vdoType"
  | "topVdoType"
  | "setTopVdoType"
  | "grain"
  | "setGrain"
  | "ratingGrain"
  | "setRatingGrain"
  | "options"
  | "digitalFiltered"
  | "tvMode"
  | "performanceValue"
  | "metrics"
  | "chartGrain"
  | "daily"
  | "types"
  | "topics"
  | "platforms"
  | "programs"
  | "top"
  | "best"
  | "provinceRating"
  | "rating"
  | "tvAudience"
  | "tvRatingBreakdown"
  | "download"
>) {
  return (
    <>
      <section className="main-grid" id="daily">
        <article className="panel wide">
          <div className="panel-head">
            <div>
              <h2>
                {tvMode ? "TV Audience ตามช่วงเวลา" : "ยอดวิวรวมตามช่วงเวลา"}
              </h2>
              <p>
                {tvMode
                  ? "ONE31 + GMM25 Audience · Hover เพื่อดู Topic"
                  : "แยกตาม VDO Type"}
              </p>
            </div>
            {tvMode ? (
              <span className="auto-grain">
                อัตโนมัติ: {chartGrain === "day" ? "รายวัน" : "รายเดือน"}
              </span>
            ) : (
              <div className="segmented">
                {(["day", "month", "year"] as const).map((x) => (
                  <button
                    key={x}
                    className={grain === x ? "active" : ""}
                    onClick={() => setGrain(x)}
                  >
                    {x === "day"
                      ? "รายวัน"
                      : x === "month"
                        ? "รายเดือน"
                        : "รายปี"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="chart-lg">
            {daily.length ? (
              <ResponsiveContainer>
                <BarChart data={daily}>
                  <CartesianGrid vertical={false} stroke="#e8edf5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) =>
                      chartGrain === "day" ? dateLabel(v) : v
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={
                      <PerformanceTooltip
                        tvMode={tvMode}
                        chartGrain={chartGrain}
                      />
                    }
                  />
                  <Legend />
                  {types.map((x) => (
                    <Bar
                      key={x.name}
                      dataKey={x.name}
                      stackId="a"
                      fill={TYPE_COLORS[x.name] || "#94a3b8"}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </article>
        <article className="panel" id="platforms">
          <div className="panel-head">
            <div>
              <h2>ยอดวิวตามแพลตฟอร์ม</h2>
              <p>รวมทุก Content Type</p>
            </div>
          </div>
          <div className="platform-bars">
            {platforms.map((x) => (
              <div key={x.name}>
                <span
                  className="platform-dot"
                  style={{ background: PLATFORM_COLORS[x.name] || "#64748b" }}
                >
                  {x.name[0]}
                </span>
                <strong>{x.name}</strong>
                <div>
                  <i
                    style={{
                      width: `${platforms[0]?.total ? (x.total / platforms[0].total) * 100 : 0}%`,
                      background: PLATFORM_COLORS[x.name] || "#2563eb",
                    }}
                  />
                </div>
                <b>{compact(x.total)}</b>
                <small>
                  {metrics.views
                    ? ((x.total / metrics.views) * 100).toFixed(1)
                    : 0}
                  %
                </small>
              </div>
            ))}
            {!platforms.length && <Empty />}
          </div>
        </article>
        <article className="panel" id="topics">
          <div className="panel-head">
            <div>
              <h2>สัดส่วนยอดวิวตาม Topic Type</h2>
              <p>ช่วงเวลาที่เลือก</p>
            </div>
          </div>
          <div className="donut-wrap">
            {topics.length ? (
              <>
                <ResponsiveContainer width="52%" height={250}>
                  <PieChart>
                    <Pie
                      data={topics}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={94}
                    >
                      {topics.map((_, i) => (
                        <Cell key={i} fill={TOPIC_COLORS[i % 10]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => num(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="legend-list">
                  {topics.map((x, i) => (
                    <div key={x.name}>
                      <i style={{ background: TOPIC_COLORS[i % 10] }} />
                      <span>{x.name}</span>
                      <b>
                        {metrics.views
                          ? ((x.total / metrics.views) * 100).toFixed(1)
                          : 0}
                        %
                      </b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty />
            )}
          </div>
        </article>
        <article className="panel table-panel" id="best">
          <div className="panel-head">
            <div>
              <h2>Top 10 ประเด็น</h2>
              <p>
                เรียงตาม{tvMode ? " TV Audience" : "ยอดวิว"}สูงสุด
                {vdoType === "ALL" && topVdoType !== "ALL"
                  ? ` · ${topVdoType}`
                  : ""}
              </p>
            </div>
            <div className="top-table-actions">
              {vdoType === "ALL" && (
                <label>
                  <span>VDO Type</span>
                  <select
                    value={topVdoType}
                    onChange={(e) => setTopVdoType(e.target.value)}
                  >
                    <option value="ALL">ทั้งหมด</option>
                    {options.vdoTypes.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
              <button onClick={download}>
                <Download />
                ดาวน์โหลด
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ประเด็น</th>
                  <th>รายการ</th>
                  <th>VDO Type</th>
                  <th>Topic Type</th>
                  <th>{tvMode ? "TV Audience" : "ยอดวิว"}</th>
                  <th>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={`${r.contentId}-${i}`}>
                    <td>{i + 1}</td>
                    <td>
                      <a href={r.url || undefined} target="_blank">
                        {r.topic || "ไม่ระบุประเด็น"}
                      </a>
                    </td>
                    <td>{r.program}</td>
                    <td>
                      <span className="tag">{r.vdoType}</span>
                    </td>
                    <td>{r.topicType}</td>
                    <td>
                      <div className="metric-bar">
                        <i
                          style={{
                            width: `${top[0] && performanceValue(top[0]) ? Math.max(5, (performanceValue(r) / performanceValue(top[0])) * 100) : 0}%`,
                          }}
                        />
                        <b>{compact(performanceValue(r))}</b>
                      </div>
                    </td>
                    <td>{tvMode ? "-" : pct(r.engagementRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <TvRatingChoropleth data={provinceRating} />
        <article className="panel wide" id="rating">
          <div className="panel-head">
            <div>
              <h2>TV Rating Score</h2>
              <p>
                Stacked Column · คะแนน Rating เฉลี่ย ({ratingGrain === "day" ? "รายวัน" : ratingGrain === "month" ? "รายเดือน" : "รายปี"}) — ยังไม่แปลง Rating × 700,000
                เป็น Views
              </p>
            </div>
            <div className="segmented">
              <button
                className={ratingGrain === "day" ? "active" : ""}
                onClick={() => setRatingGrain("day")}
              >
                รายวัน
              </button>
              <button
                className={ratingGrain === "month" ? "active" : ""}
                onClick={() => setRatingGrain("month")}
              >
                รายเดือน
              </button>
              <button
                className={ratingGrain === "year" ? "active" : ""}
                onClick={() => setRatingGrain("year")}
              >
                รายปี
              </button>
            </div>
          </div>
          <div className="chart-lg">
            {rating.length ? (
              <ResponsiveContainer>
                <BarChart data={rating}>
                  <CartesianGrid vertical={false} stroke="#e8edf5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(label) =>
                      ratingGrain === "year"
                        ? String(label)
                        : ratingGrain === "month"
                          ? String(label)
                          : dateLabel(String(label))
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => Number(v).toFixed(2)}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => Number(v).toFixed(3)}
                    labelFormatter={(label) =>
                      ratingGrain === "year"
                        ? `ปี ${label}`
                        : ratingGrain === "month"
                          ? `เดือน ${label}`
                          : dateLabel(String(label ?? ""))
                    }
                  />
                  <Legend />
                  <Bar dataKey="Total" stackId="rating" fill="#1d4ed8" />
                  <Bar dataKey="15+BKK" stackId="rating" fill="#16a34a" />
                  <Bar dataKey="15+URBAN" stackId="rating" fill="#f59e0b" />
                  <Bar dataKey="15+BKK&URBAN" stackId="rating" fill="#9333ea" />
                  <Bar
                    dataKey="15+RURAL"
                    stackId="rating"
                    fill="#0891b2"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="ไม่มีข้อมูล TV Rating ในช่วงที่เลือก" />
            )}
          </div>
        </article>
        <article className="panel wide tv-rating-breakdown">
          <div className="panel-head">
            <div>
              <h2>TV Rating แยกตามรายการและช่อง</h2>
              <p>เงินทองของจริง / ถกไม่เถียง · One31 / GMM25</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>รายการ</th><th>ช่อง</th><th>Rating เฉลี่ย</th><th>TV Audience</th><th>จำนวนตอน</th></tr></thead>
              <tbody>{tvRatingBreakdown.map((x) => <tr key={x.program + "-" + x.channel}><td>{x.program}</td><td>{x.channel}</td><td>{x.rating.toFixed(3)}</td><td>{compact(x.audience)}</td><td>{num(x.episodes)}</td></tr>)}</tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>TV Audience</h2>
              <p>จำนวนผู้ชมจริง · Hover เพื่อดู Topic</p>
            </div>
          </div>
          <div className="chart-lg">
            {tvAudience.length ? (
              <ResponsiveContainer>
                <LineChart data={tvAudience}>
                  <CartesianGrid vertical={false} stroke="#e8edf5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateLabel}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
                  <Tooltip content={<TvAudienceTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ONE31"
                    stroke="#1261dc"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="GMM25"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="ไม่มีข้อมูล TV Audience ในช่วงที่เลือก" />
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Performance by VDO Type</h2>
              <p>สัดส่วนยอดวิว</p>
            </div>
          </div>
          <div className="donut-wrap small">
            {types.length ? (
              <>
                <ResponsiveContainer width="52%" height={230}>
                  <PieChart>
                    <Pie
                      data={types}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={86}
                    >
                      {types.map((x, i) => (
                        <Cell
                          key={i}
                          fill={TYPE_COLORS[x.name] || TOPIC_COLORS[i]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => num(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="legend-list">
                  {types.map((x) => (
                    <div key={x.name}>
                      <i
                        style={{ background: TYPE_COLORS[x.name] || "#64748b" }}
                      />
                      <span>{x.name}</span>
                      <b>
                        {metrics.views
                          ? ((x.total / metrics.views) * 100).toFixed(1)
                          : 0}
                        %
                      </b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty />
            )}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Engagement Rate by Topic Type</h2>
              <p>Top 5 · Digital Only</p>
            </div>
          </div>
          <div className="horizontal-bars">
            {sumBy(
              digitalFiltered.filter((r) => r.views > 0),
              (r) => r.topicType,
              (r) => r.engagement,
            )
              .map((x) => ({
                ...x,
                views: digitalFiltered
                  .filter((r) => r.topicType === x.name)
                  .reduce((a, r) => a + r.views, 0),
              }))
              .map((x) => ({ ...x, rate: x.views ? x.total / x.views : 0 }))
              .sort((a, b) => b.rate - a.rate)
              .slice(0, 5)
              .map((x) => (
                <div key={x.name}>
                  <span>{x.name}</span>
                  <div>
                    <i style={{ width: `${Math.min(100, x.rate * 500)}%` }} />
                  </div>
                  <b>{pct(x.rate)}</b>
                </div>
              ))}
          </div>
        </article>
        <article className="panel best-panel">
          <div className="panel-head">
            <div>
              <h2>🏆 Best of Month</h2>
              <p>Top 5</p>
            </div>
          </div>
          <ol>
            {best.map((r, i) => (
              <li key={`${r.contentId}-${i}`}>
                <b>{i + 1}</b>
                <span>{r.topic}</span>
                <strong>{compact(performanceValue(r))}</strong>
              </li>
            ))}
          </ol>
        </article>
        <article className="panel" id="programs">
          <div className="panel-head">
            <div>
              <h2>รายการ (Program) Performance</h2>
              <p>ยอดวิวรวมช่วงที่เลือก</p>
            </div>
          </div>
          <div className="horizontal-bars programs">
            {programs.map((x) => (
              <div key={x.name}>
                <span>{x.name}</span>
                <div>
                  <i
                    style={{
                      width: `${programs[0]?.total ? (x.total / programs[0].total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <b>{compact(x.total)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
