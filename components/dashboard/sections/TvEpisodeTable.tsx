"use client";
// TV Overview Report → TV Rating รายเทป: every episode in the date filter, newest
// first, with both channels' rating and audience as in the TV file.
import { useEffect, useState } from "react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { Empty } from "@/components/dashboard/shared/Empty";

/** Episodes per page; older ones are a page away. */
const PAGE = 10;
/** "พ. 1 ต.ค. 69" */
const thaiDay = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${iso}T00:00:00Z`));

export function TvEpisodeTable({ episodes }: { episodes: RecordRow[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(episodes.length / PAGE));
  // New filters: back to the latest episodes.
  useEffect(() => setPage(1), [episodes]);
  const at = Math.min(page, pages);
  const shown = episodes.slice((at - 1) * PAGE, at * PAGE);
  const newest = episodes[0]?.date;
  const oldest = episodes[episodes.length - 1]?.date;
  return (
    <article className="panel tv-last-week">
      <div className="panel-head">
        <div>
          <h2>TV Rating รายเทป</h2>
          <p>
            {episodes.length
              ? `ตามช่วงวันที่ที่เลือก · ${num(episodes.length)} เทป ออกอากาศ ${thaiDay(oldest)} – ${thaiDay(newest)} · เรียงจากวันล่าสุด`
              : "ไม่มีเทปในช่วงที่เลือก"}
          </p>
        </div>
      </div>
      {episodes.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>วันที่ออกอากาศ</th>
                  <th>รายการ</th>
                  <th>ประเด็น</th>
                  <th className="num">One31</th>
                  <th className="num">GMM25</th>
                  <th className="num">ผู้ชม One31</th>
                  <th className="num">ผู้ชม GMM25</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={`${r.date}-${r.program}-${i}`}>
                    <td>{thaiDay(r.date)}</td>
                    <td>{r.program}</td>
                    <td className="tv-last-week-topic">{r.topic || "-"}</td>
                    <td className="num strong">{r.ratingTotal > 0 ? r.ratingTotal.toFixed(3) : "-"}</td>
                    <td className="num">{r.gmmRating > 0 ? r.gmmRating.toFixed(3) : "-"}</td>
                    <td className="num">{r.audienceTotal > 0 ? compact(r.audienceTotal) : "-"}</td>
                    <td className="num">{r.gmmAudience > 0 ? compact(r.gmmAudience) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pagination">
              <span>
                หน้า {at} / {pages} · เทปที่ {num((at - 1) * PAGE + 1)}–{num(Math.min(at * PAGE, episodes.length))} จาก {num(episodes.length)}
              </span>
              <button type="button" onClick={() => setPage(1)} disabled={at === 1} title="ล่าสุด">
                «
              </button>
              <button type="button" onClick={() => setPage(at - 1)} disabled={at === 1}>
                ใหม่กว่า
              </button>
              <button type="button" onClick={() => setPage(at + 1)} disabled={at === pages}>
                เก่ากว่า
              </button>
              <button type="button" onClick={() => setPage(pages)} disabled={at === pages} title="เก่าสุด">
                »
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty text="ไม่มีเทปในช่วงที่เลือก" />
      )}
    </article>
  );
}
