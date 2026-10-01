"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ThumbsDown, Trophy, Tv } from "lucide-react";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, num } from "@/lib/dashboard/format";
import {
  periodFor,
  rankClips,
  rankEpisodes,
  shiftPeriod,
  type RankGrain,
  type RankedClip,
} from "@/lib/dashboard/ranking";

const thDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`));

/** "range" = the report range from the date filter at the top. */
type Mode = "range" | RankGrain;

function periodLabel(start: string, end: string, grain: Mode) {
  if (grain === "day" || start === end) {
    return thDate(start, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${thDate(start, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} – ${thDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function indexText(x: RankedClip) {
  if (x.index === null) return "ยังไม่มีค่าปกติให้เทียบ";
  return x.index >= 1
    ? `${x.index.toFixed(1)}× ของค่าปกติ`
    : `${Math.round(x.index * 100)}% ของค่าปกติ`;
}

function ClipList({ items, tone }: { items: RankedClip[]; tone: "best" | "worst" }) {
  if (!items.length) {
    return <p className="ranking-empty">ไม่มีคลิปในช่วงนี้</p>;
  }
  return (
    <ol className={`ranking-list ${tone}`}>
      {items.map((x, i) => (
        <li key={`${x.row.contentId || x.row.url || x.row.topic}-${i}`}>
          <b className="ranking-no">{i + 1}</b>
          <div className="ranking-body">
            <a href={x.row.url || undefined} target="_blank" rel="noreferrer" title={x.row.topic}>
              {x.row.topic || "ไม่ระบุประเด็น"}
            </a>
            <small>
              <span className="tag">{x.row.platform}</span> {x.row.vdoType}
              {x.fresh && <span className="ranking-fresh" title="ลงไม่ถึง 2 วัน ยอดยังเพิ่มอยู่">ใหม่</span>}
            </small>
          </div>
          <div className="ranking-metric">
            <strong>{compact(x.row.views)}</strong>
            <small className={x.index !== null && x.index < 1 ? "down" : "up"}>{indexText(x)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

const TV_EACH_END = 5;

export function RankingSection({
  rankingRows,
  dataLatestDate,
  startDate,
  endDate,
}: Pick<DashboardModel, "rankingRows" | "dataLatestDate" | "startDate" | "endDate">) {
  const [grain, setGrain] = useState<Mode>("range");
  const [anchor, setAnchor] = useState("");
  const [allEpisodes, setAllEpisodes] = useState(false);
  // A new report range at the top brings the card back to that range.
  useEffect(() => {
    setGrain("range");
    setAllEpisodes(false);
  }, [startDate, endDate]);

  // Clips and TV ratings arrive on different schedules, so start from the
  // newest day that has clips (else the newest data), capped by the date filter.
  const latestClipDate = useMemo(
    () =>
      rankingRows.reduce(
        (max, r) => (r.platform !== "TV" && r.ratingTotal <= 0 && r.date > max ? r.date : max),
        "",
      ),
    [rankingRows],
  );
  const newest = latestClipDate || dataLatestDate;
  const defaultAnchor = endDate && endDate < newest ? endDate : newest;
  useEffect(() => setAnchor(defaultAnchor), [defaultAnchor]);

  const current = anchor || defaultAnchor;
  const period = useMemo(() => {
    if (grain === "range") return startDate && endDate && startDate <= endDate ? { start: startDate, end: endDate } : null;
    return current ? periodFor(current, grain) : null;
  }, [current, grain, startDate, endDate]);
  const clips = useMemo(
    () => (period ? rankClips(rankingRows, period, newest) : { best: [], worst: [], total: 0, baselineKind: "prior30" as const }),
    [rankingRows, period, newest],
  );
  const episodes = useMemo(() => (period ? rankEpisodes(rankingRows, period) : []), [rankingRows, period]);

  if (!period) return null;
  const atLatest = period.end >= dataLatestDate;
  // Long lists: the top and bottom episodes, the rest on request.
  const trimmed = !allEpisodes && episodes.length > TV_EACH_END * 2;
  const shown = trimmed
    ? [...episodes.slice(0, TV_EACH_END).map((x, i) => ({ x, i })), ...episodes.slice(-TV_EACH_END).map((x, i) => ({ x, i: episodes.length - TV_EACH_END + i }))]
    : episodes.map((x, i) => ({ x, i }));

  return (
    <section className="panel ranking-panel" id="ranking">
      <div className="panel-head">
        <div>
          <h2>Ranking: ดีที่สุด / แย่ที่สุด</h2>
          <p>
            คลิปที่ลงใน{grain === "day" ? "วัน" : grain === "week" ? "สัปดาห์" : "ช่วง"}นี้ {num(clips.total)} ชิ้น · เทียบกับค่าปกติของแพลตฟอร์มและรูปแบบเดียวกัน
          </p>
        </div>
        <div className="ranking-controls">
          <div className="segmented">
            <button className={grain === "range" ? "active" : ""} onClick={() => setGrain("range")} title="ช่วงเดียวกับตัวกรองวันที่ด้านบน">
              ตามช่วงรายงาน
            </button>
            <button className={grain === "day" ? "active" : ""} onClick={() => setGrain("day")}>
              รายวัน
            </button>
            <button className={grain === "week" ? "active" : ""} onClick={() => setGrain("week")}>
              รายสัปดาห์
            </button>
          </div>
          <div className="ranking-nav">
            {grain !== "range" && (
              <button type="button" aria-label="ช่วงก่อนหน้า" onClick={() => setAnchor(shiftPeriod(current, grain, -1))}>
                <ChevronLeft size={16} />
              </button>
            )}
            <span>{periodLabel(period.start, period.end, grain)}</span>
            {grain !== "range" && (
              <button
                type="button"
                aria-label="ช่วงถัดไป"
                disabled={atLatest}
                onClick={() => setAnchor(shiftPeriod(current, grain, 1))}
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ranking-grid">
        <article>
          <h3>
            <Trophy size={16} /> คลิปดีที่สุด
          </h3>
          <ClipList items={clips.best} tone="best" />
        </article>
        <article>
          <h3>
            <ThumbsDown size={16} /> คลิปแย่ที่สุด
          </h3>
          <ClipList items={clips.worst} tone="worst" />
        </article>
        <article className="ranking-tv">
          <h3>
            <Tv size={16} /> เทปรายการทีวี (เรียงตามเรตติ้ง One31)
          </h3>
          {episodes.length ? (
            <ol className="ranking-list">
              {shown.map(({ x, i }, k) => (
                <li
                  key={`${x.row.date}-${x.row.program}`}
                  data-gap={trimmed && k === TV_EACH_END ? "true" : undefined}
                  className={episodes.length > 1 && i === 0 ? "top" : episodes.length > 1 && i === episodes.length - 1 ? "bottom" : ""}
                >
                  <b className="ranking-no">{i + 1}</b>
                  <div className="ranking-body">
                    <span title={x.row.topic}>{x.row.topic || x.row.program}</span>
                    <small>
                      {thDate(x.row.date, { weekday: "short", day: "numeric", month: "short" })} · GMM25{" "}
                      {x.row.gmmRating > 0 ? x.row.gmmRating.toFixed(3) : "-"} · ผู้ชม{" "}
                      {compact(x.row.audienceTotal + x.row.gmmAudience)}
                    </small>
                  </div>
                  <div className="ranking-metric">
                    <strong>{x.row.ratingTotal.toFixed(3)}</strong>
                    {x.vsAverage !== null && (
                      <small className={x.vsAverage >= 0 ? "up" : "down"}>
                        {x.vsAverage >= 0 ? "▲" : "▼"} {Math.abs(x.vsAverage * 100).toFixed(0)}% จากเฉลี่ย 4 สัปดาห์
                      </small>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ranking-empty">ไม่มีเทปที่มีเรตติ้งในช่วงนี้</p>
          )}
          {episodes.length > TV_EACH_END * 2 && (
            <button type="button" className="ranking-more" onClick={() => setAllEpisodes((v) => !v)}>
              {allEpisodes ? `แสดงเฉพาะ ${TV_EACH_END} สูงสุด / ต่ำสุด` : `ดูทั้งหมด ${episodes.length} เทป`}
            </button>
          )}
        </article>
      </div>
      <p className="ai-note ranking-note">
        ค่าปกติ = ค่ามัธยฐานยอดวิวของคลิปแพลตฟอร์มและรูปแบบเดียวกัน
        {clips.baselineKind === "within" ? "ภายในช่วงนี้ (ช่วงยาวกว่า 1 เดือน)" : "ใน 30 วันก่อนหน้า"} ·
        “แย่ที่สุด” ไม่นับคลิปที่ลงไม่ถึง 2 วัน · ยอดวิวเป็นยอดสะสม ณ วันที่อัปเดตข้อมูลล่าสุด
      </p>
    </section>
  );
}
