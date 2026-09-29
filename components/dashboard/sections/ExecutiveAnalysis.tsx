"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { explicitGuest, presenter } from "@/lib/dashboard/analytics";
import { compact, dateLabel, pct } from "@/lib/dashboard/format";

function growthText(growth: number | null) {
  if (growth === null) return "ไม่มียอดใน 30 วันก่อนหน้า";
  return `แนวโน้ม${growth >= 0 ? "เพิ่ม" : "ลด"} ${Math.abs(growth * 100).toFixed(1)}%`;
}
export function ExecutiveAnalysis({
  tvMode,
  performanceValue,
  top,
  platformAnalysis,
  topicTrend,
  q4Plan,
}: Pick<
  DashboardModel,
  | "tvMode"
  | "performanceValue"
  | "top"
  | "platformAnalysis"
  | "topicTrend"
  | "q4Plan"
>) {
  return (
    <>
      <section className="panel ai-analysis" id="ai-analysis">
        <div className="panel-head">
          <div>
            <h2>✨ AI Executive Analysis</h2>
            <p>วิเคราะห์ใหม่อัตโนมัติจาก Master Data ตามตัวกรองที่เลือก</p>
          </div>
          <span className="ai-badge">DATA-DRIVEN</span>
        </div>
        <div className="ai-summary-grid mobile-hide">
          <article>
            <span>เนื้อหายอดสูงสุด</span>
            <strong>{top[0]?.topic || "ไม่มีข้อมูล"}</strong>
            {top[0] && (
              <>
                <small>
                  {top[0].platform} · {dateLabel(top[0].date)} ·{" "}
                  {compact(performanceValue(top[0]))}{" "}
                  {tvMode ? "Audience" : "Views"}
                </small>
                {presenter(top[0].program) && (
                  <small>พิธีกร: {presenter(top[0].program)}</small>
                )}
                {explicitGuest(top[0].topic) && (
                  <small>แขกรับเชิญ: {explicitGuest(top[0].topic)}</small>
                )}
              </>
            )}
          </article>
          <article>
            <span>ข่าวที่คนสนใจมากที่สุดใน 30 วันล่าสุด</span>
            <strong>{topicTrend[0]?.name || "ข้อมูลยังไม่พอ"}</strong>
            {topicTrend[0] && (
              <small>
                {compact(topicTrend[0].recent)} Views · {growthText(topicTrend[0].growth)}
              </small>
            )}
          </article>
          <article>
            <span>ข้อเสนอ Highlight ไตรมาส 4</span>
            <strong>
              {q4Plan.topics.map((x) => x.name).join(" · ") || "ข้อมูลยังไม่พอ"}
            </strong>
            <small>คัดจาก Topic Type ที่มียอดวิวสูงใน 90 วันล่าสุด</small>
          </article>
        </div>
        <div className="ai-platform-table table-scroll mobile-cards">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Top Content</th>
                <th>วันที่ลง</th>
                <th>พิธีกร</th>
                <th>แขกรับเชิญ</th>
                <th>Views</th>
                <th>Engagement</th>
                <th>ข่าวที่เด่น</th>
                <th>Content/VDO Type ที่ควรทำต่อ</th>
              </tr>
            </thead>
            <tbody>
              {platformAnalysis.map((x) => (
                <tr key={x.name}>
                  <td data-label="Platform">
                    <b>{x.name}</b>
                  </td>
                  <td data-label="Top Content">
                    <a href={x.top?.url || undefined} target="_blank">
                      {x.top?.topic || "-"}
                    </a>
                  </td>
                  <td data-label="วันที่ลง">{x.top ? dateLabel(x.top.date) : "-"}</td>
                  <td data-label="พิธีกร">{(x.top && presenter(x.top.program)) || "-"}</td>
                  <td data-label="แขกรับเชิญ">{(x.top && explicitGuest(x.top.topic)) || "-"}</td>
                  <td data-label="Views">{compact(x.top?.views || 0)}</td>
                  <td data-label="Engagement">{pct(x.top?.engagementRate || 0)}</td>
                  <td data-label="ข่าวที่เด่น">{x.topic}</td>
                  <td data-label="ควรทำต่อ">
                    <b>{x.format?.name || "-"}</b>
                    {x.format && (
                      <small>
                        เฉลี่ย {compact(x.format.avgViews)} Views · ER{" "}
                        {pct(x.format.rate)}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ai-bottom-grid">
          <article>
            <h3>แนวโน้ม Topic Type</h3>
            <p className="ai-note">ยอดวิว 30 วันล่าสุด เทียบกับ 30 วันก่อนหน้า</p>
            {topicTrend.map((x, i) => (
              <div className="trend-row" key={x.name}>
                <b>{i + 1}</b>
                <span>{x.name}</span>
                <strong>{compact(x.recent)}</strong>
                <em
                  className={x.growth === null ? "new" : x.growth >= 0 ? "up" : "down"}
                  title="เทียบยอดวิว 30 วันล่าสุดกับ 30 วันก่อนหน้า"
                >
                  {x.growth === null
                    ? "ใหม่"
                    : `${x.growth >= 0 ? "▲" : "▼"} ${Math.abs(x.growth * 100).toFixed(1)}%`}
                </em>
              </div>
            ))}
          </article>
          <article>
            <h3>แผน Highlight ไตรมาส 4</h3>
            <p>
              ทำชุดสรุปประเด็นจาก{" "}
              <b>
                {q4Plan.topics.map((x) => x.name).join(", ") ||
                  "Topic ที่มีข้อมูลสูงสุด"}
              </b>
            </p>
            <p>
              รูปแบบที่ข้อมูลสนับสนุน:{" "}
              {q4Plan.formats.map((x) => (
                <span className="tag" key={x.platform}>
                  {x.platform}: {x.format?.name}
                </span>
              ))}
            </p>
            <p className="ai-note">
              หลักเลือก: ยอดวิวเฉลี่ยต่อชิ้น + Engagement Rate
              ไม่ใช่ดูยอดรวมอย่างเดียว
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
