"use client";
import { SortHead } from "@/components/dashboard/shared/SortHead";
import { Button } from "@/components/ui/button";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, dateLabel, num } from "@/lib/dashboard/format";
import type { CompareFilter, CompareRow, CompareSortKey } from "@/lib/dashboard/types";
import { Download } from "lucide-react";

const FILTERS: [CompareFilter, string][] = [
  ["all", "ทั้งหมด"],
  ["tv", "เฉพาะเทปที่ออกทีวี"],
  ["online", "เฉพาะคลิปออนไลน์"],
];

/** Number or a grey dash, so an empty cell never reads as "0 views". */
function Val({ v, digits }: { v: number; digits?: number }) {
  if (!v) return <span className="ep-empty">–</span>;
  return <>{digits !== undefined ? v.toFixed(digits) : compact(v)}</>;
}

type HeatKey = "youtube" | "facebook" | "tiktok";

export function CompareTable({
  comparePage,
  setComparePage,
  comparePageSize,
  setComparePageSize,
  compareSort,
  compareDirection,
  compareSorted,
  compareTotals,
  compareFilter,
  setCompareFilter,
  comparePageCount,
  compareRows,
  sortCompare,
  download,
  canDownload = true,
}: { canDownload?: boolean } & Pick<
  DashboardModel,
  | "comparePage"
  | "setComparePage"
  | "comparePageSize"
  | "setComparePageSize"
  | "compareSort"
  | "compareDirection"
  | "compareSorted"
  | "compareTotals"
  | "compareFilter"
  | "setCompareFilter"
  | "comparePageCount"
  | "compareRows"
  | "sortCompare"
  | "download"
>) {
  const head = (label: string, column: CompareSortKey, className?: string) => (
    <SortHead
      label={label}
      column={column}
      active={compareSort}
      direction={compareDirection}
      onSort={sortCompare}
      className={className}
    />
  );

  // Light shading on the platform columns: darker = more views on this page.
  const max: Record<HeatKey, number> = {
    youtube: Math.max(0, ...compareRows.map((r) => r.youtube)),
    facebook: Math.max(0, ...compareRows.map((r) => r.facebook)),
    tiktok: Math.max(0, ...compareRows.map((r) => r.tiktok)),
  };
  const heat = (r: CompareRow, key: HeatKey) =>
    r[key] && max[key]
      ? { background: `rgba(7, 87, 232, ${(0.05 + 0.22 * (r[key] / max[key])).toFixed(3)})` }
      : undefined;

  const t = compareTotals;

  return (
    <>
      <section className="panel compare-panel" id="compare">
        <div className="panel-head">
          <div>
            <h2>ผลงานรายเทป: ทีวี + ออนไลน์</h2>
            <p>
              ประเด็นเดียวกันในวันเดียวกัน รวมผลจากทีวีและทุกแพลตฟอร์ม · {num(t.count)} รายการ (ออกทีวี{" "}
              {num(t.tvCount)}) · กดหัวตารางเพื่อเรียง
            </p>
          </div>
          <div className="ep-actions">
            <div className="segmented" role="group" aria-label="กรองรายการ">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  className={compareFilter === value ? "active" : ""}
                  onClick={() => setCompareFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {canDownload && (
              <Button variant="outline" onClick={download}>
                <Download />
                Export CSV
              </Button>
            )}
          </div>
        </div>
        <div className="table-scroll">
          <table className="ep-table">
            <thead>
              <tr className="ep-groups">
                <th colSpan={2}>เทป</th>
                <th colSpan={2} className="ep-g-tv">ทีวี</th>
                <th colSpan={4} className="ep-g-online">ออนไลน์</th>
                <th colSpan={2} className="ep-g-total">รวม</th>
              </tr>
              <tr>
                {head("วันที่", "date")}
                {head("ประเด็น", "topic")}
                {head("เรตติ้ง", "one", "num ep-tv")}
                {head("ผู้ชมทีวี", "tvAudience", "num ep-tv")}
                {head("YouTube", "youtube", "num")}
                {head("FB/IG", "facebook", "num")}
                {head("TikTok", "tiktok", "num")}
                {head("รวมออนไลน์", "online", "num ep-online-total")}
                {head("ยอดรวมทั้งหมด", "total", "num ep-total")}
                {head("Engagement", "engagement", "num")}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r, i) => (
                <tr key={`${r.date}-${r.topic}-${i}`}>
                  <td className="ep-date">{dateLabel(r.date)}</td>
                  <td className="ep-topic" title={r.page ? `เพจ/ช่อง: ${r.page}` : undefined}>
                    <span className="ep-topic-text">{r.topic || "-"}</span>
                    <small>
                      <span className={`ep-badge ${r.hasTv ? "tv" : "online"}`}>
                        {r.hasTv ? "ออกทีวี" : "ออนไลน์อย่างเดียว"}
                      </span>
                      {r.program}
                    </small>
                  </td>
                  <td className="num ep-tv">
                    {r.one ? (
                      <>
                        <b>{r.one.toFixed(3)}</b>
                        <small>GMM {r.gmm ? r.gmm.toFixed(3) : "–"}</small>
                      </>
                    ) : r.gmm ? (
                      <small>GMM {r.gmm.toFixed(3)}</small>
                    ) : (
                      <span className="ep-empty">–</span>
                    )}
                  </td>
                  <td className="num ep-tv">
                    <Val v={r.tvAudience} />
                  </td>
                  <td className="num" style={heat(r, "youtube")}>
                    <Val v={r.youtube} />
                  </td>
                  <td className="num" style={heat(r, "facebook")}>
                    <Val v={r.facebook} />
                  </td>
                  <td className="num" style={heat(r, "tiktok")}>
                    <Val v={r.tiktok} />
                  </td>
                  <td className="num ep-online-total">
                    <Val v={r.online} />
                  </td>
                  <td className="num ep-total">
                    <b>
                      <Val v={r.total} />
                    </b>
                  </td>
                  <td className="num">
                    <Val v={r.engagement} />
                  </td>
                </tr>
              ))}
              {!compareRows.length && (
                <tr>
                  <td colSpan={10} className="ep-none">
                    ไม่มีรายการในตัวกรองนี้
                  </td>
                </tr>
              )}
            </tbody>
            {t.count > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>รวมทั้งหมดที่กรอง ({num(t.count)} รายการ)</td>
                  <td className="num ep-tv" title="เฉลี่ย One31 / GMM25">
                    <b>{t.one ? t.one.toFixed(3) : "–"}</b>
                    <small>GMM {t.gmm ? t.gmm.toFixed(3) : "–"}</small>
                  </td>
                  <td className="num ep-tv"><Val v={t.tvAudience} /></td>
                  <td className="num"><Val v={t.youtube} /></td>
                  <td className="num"><Val v={t.facebook} /></td>
                  <td className="num"><Val v={t.tiktok} /></td>
                  <td className="num ep-online-total"><Val v={t.online} /></td>
                  <td className="num ep-total">
                    <b><Val v={t.total} /></b>
                  </td>
                  <td className="num"><Val v={t.engagement} /></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="pagination">
          <span>
            หน้า {comparePage} / {comparePageCount}
          </span>
          <label>
            แถวต่อหน้า{" "}
            <select
              value={comparePageSize}
              onChange={(e) => setComparePageSize(Number(e.target.value))}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <button
            onClick={() => setComparePage(1)}
            disabled={comparePage === 1}
          >
            «
          </button>
          <button
            onClick={() => setComparePage((p) => Math.max(1, p - 1))}
            disabled={comparePage === 1}
          >
            ก่อนหน้า
          </button>
          <button
            onClick={() =>
              setComparePage((p) => Math.min(comparePageCount, p + 1))
            }
            disabled={comparePage === comparePageCount}
          >
            ถัดไป
          </button>
          <button
            onClick={() => setComparePage(comparePageCount)}
            disabled={comparePage === comparePageCount}
          >
            »
          </button>
        </div>
      </section>
    </>
  );
}
