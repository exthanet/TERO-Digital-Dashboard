"use client";
import { SortHead } from "@/components/dashboard/shared/SortHead";
import { Button } from "@/components/ui/button";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, dateLabel, num } from "@/lib/dashboard/format";
import { Download } from "lucide-react";
export function CompareTable({
  comparePage,
  setComparePage,
  comparePageSize,
  setComparePageSize,
  compareSort,
  compareDirection,
  compareSorted,
  comparePageCount,
  compareRows,
  sortCompare,
  download,
}: Pick<
  DashboardModel,
  | "comparePage"
  | "setComparePage"
  | "comparePageSize"
  | "setComparePageSize"
  | "compareSort"
  | "compareDirection"
  | "compareSorted"
  | "comparePageCount"
  | "compareRows"
  | "sortCompare"
  | "download"
>) {
  return (
    <>
      <section className="panel compare-panel" id="compare">
        <div className="panel-head">
          <div>
            <h2>Compare Table — Live & Episode</h2>
            <p>
              ข้อมูลทั้งหมด {num(compareSorted.length)} รายการ · กดหัวตารางเพื่อ
              Sort
            </p>
          </div>
          <Button variant="outline" onClick={download}>
            <Download />
            Export CSV
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortHead
                  label="วันที่"
                  column="date"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="ประเด็น"
                  column="topic"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="รายการ"
                  column="program"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="ONE31 Rating"
                  column="one"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="ONE31 Audience"
                  column="oneAudience"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="GMM25 Rating"
                  column="gmm"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="GMM25 Audience"
                  column="gmmAudience"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="YouTube Views"
                  column="youtube"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="Facebook/IG Views"
                  column="facebook"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="TikTok Views"
                  column="tiktok"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="Engagement"
                  column="engagement"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
                <SortHead
                  label="Page Name"
                  column="page"
                  active={compareSort}
                  direction={compareDirection}
                  onSort={sortCompare}
                />
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r, i) => (
                <tr key={`${r.date}-${r.topic}-${i}`}>
                  <td>{dateLabel(r.date)}</td>
                  <td>{r.topic || "-"}</td>
                  <td>{r.program}</td>
                  <td>{r.one ? r.one.toFixed(3) : "-"}</td>
                  <td>{r.oneAudience ? num(r.oneAudience) : "-"}</td>
                  <td>{r.gmm ? r.gmm.toFixed(3) : "-"}</td>
                  <td>{r.gmmAudience ? num(r.gmmAudience) : "-"}</td>
                  <td>{compact(r.youtube)}</td>
                  <td>{compact(r.facebook)}</td>
                  <td>{compact(r.tiktok)}</td>
                  <td>{compact(r.engagement)}</td>
                  <td>{r.page || "-"}</td>
                </tr>
              ))}
            </tbody>
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
