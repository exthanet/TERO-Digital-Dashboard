"use client";
import { TvAudienceTooltip } from "@/components/dashboard/charts/TvAudienceTooltip";
import { Empty } from "@/components/dashboard/shared/Empty";
import TvRatingChoropleth from "@/components/dashboard/TvRatingChoropleth";
import type { DashboardModel } from "@/hooks/useDashboard";
import {
  TOPIC_COLORS,
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
  topTopicType,
  setTopTopicType,
  topicType,
  options,
  tvMode,
  performanceValue,
  metrics,
  topics,
  top,
  provinceRating,
  rating,
  ratingGrain,
  setRatingGrain,
  tvAudience,
  tvRatingBreakdown,
  download,
  audienceReport,
  tvCompetitors,
  canDownload = true,
}: { audienceReport?: React.ReactNode; tvCompetitors?: React.ReactNode; canDownload?: boolean } & Pick<
  DashboardModel,
  | "topTopicType"
  | "setTopTopicType"
  | "topicType"
  | "ratingGrain"
  | "setRatingGrain"
  | "options"
  | "tvMode"
  | "performanceValue"
  | "metrics"
  | "topics"
  | "top"
  | "provinceRating"
  | "rating"
  | "tvAudience"
  | "tvRatingBreakdown"
  | "download"
>) {
  return (
    <>
      <section className="main-grid">
        <article className="panel table-panel" id="best">
          <div className="panel-head">
            <div>
              <h2>Top 10 ประเด็น</h2>
              <p>
                เรียงตาม{tvMode ? " TV Audience" : "ยอดวิว"}สูงสุด
                {topicType === "ALL" && topTopicType !== "ALL"
                  ? ` · ${topTopicType}`
                  : ""}
              </p>
            </div>
            <div className="top-table-actions">
              {topicType === "ALL" && (
                <label>
                  <span>Topic Type</span>
                  <select
                    value={topTopicType}
                    onChange={(e) => setTopTopicType(e.target.value)}
                  >
                    <option value="ALL">ทั้งหมด</option>
                    {options.topicTypes.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
              {canDownload && (
                <button onClick={download}>
                  <Download />
                  ดาวน์โหลด
                </button>
              )}
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ประเด็น</th>
                  <th className="mobile-hide">รายการ</th>
                  <th className="mobile-hide">VDO Type</th>
                  <th className="mobile-hide">Topic Type</th>
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
                    <td className="mobile-hide">{r.program}</td>
                    <td className="mobile-hide">
                      <span className="tag">{r.vdoType}</span>
                    </td>
                    <td className="mobile-hide">{r.topicType}</td>
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
        {/* TV Overview Report: every TV view in one group (sidebar "TV Rating" opens it). */}
        <section className="report-group" id="rating">
          <div className="report-group-head">
            <h2>TV Overview Report</h2>
            <p>Rating, โซน, ผู้ชม และคู่แข่ง ของรายการทีวีในช่วงที่เลือก · ค่าดิบจากไฟล์ TV</p>
          </div>
          <div className="main-grid">
            <article className="panel wide" id="rating-score">
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
            <TvRatingChoropleth data={provinceRating} />
            {/* TV Audience (wider) beside the rating table, 3 : 2 */}
            <div className="tv-pair">
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
              <article className="panel tv-rating-breakdown">
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
            </div>
            {tvCompetitors}
          </div>
        </section>
        {audienceReport}
      </section>
    </>
  );
}
