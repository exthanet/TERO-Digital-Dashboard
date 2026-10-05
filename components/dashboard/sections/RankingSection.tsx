"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ThumbsDown, Trophy, Tv } from "lucide-react";
import type { DashboardModel } from "@/hooks/useDashboard";
import { compact, num } from "@/lib/dashboard/format";
import {
  periodFor,
  rankClips,
  rankContents,
  type ClipOrder,
  rankEpisodes,
  shiftPeriod,
  type RankGrain,
  type RankedClip,
  type RankedContent,
} from "@/lib/dashboard/ranking";
import { HelpLink } from "@/components/dashboard/sections/HelpSection";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";
import type { RecordRow } from "@/lib/dashboard/types";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";

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

function indexText(x: { index: number | null }) {
  if (x.index === null) return "ยังไม่มีค่าปกติให้เทียบ";
  return x.index >= 1
    ? `${x.index.toFixed(1)}× ของค่าปกติ`
    : `${Math.round(x.index * 100)}% ของค่าปกติ`;
}

/** One line of the best / worst lists: a post, or a piece of content on several platforms. */
interface ListItem {
  key: string;
  row: RecordRow;
  views: number;
  index: number | null;
  fresh: boolean;
  sub: React.ReactNode;
}

const PlatformName = ({ name }: { name: string }) => <b style={{ color: PLATFORM_COLORS[name] || "#475569" }}>{name}</b>;

/** Per post: the platform and format. */
const postItem = (x: RankedClip): ListItem => ({
  key: `${x.row.platform}|${x.row.contentId || x.row.url || x.row.topic}`,
  row: x.row,
  views: x.row.views,
  index: x.index,
  fresh: x.fresh,
  sub: (
    <>
      <span className="tag">{x.row.platform}</span> {x.row.vdoType}
    </>
  ),
});

/** Per content: the platform with the most and the fewest views. */
const contentItem = (x: RankedContent): ListItem => {
  const p = x.group.platforms;
  const top = p[0];
  const low = p[p.length - 1];
  return {
    key: x.group.key,
    row: x.group.lead,
    views: x.group.views,
    index: x.index,
    fresh: x.fresh,
    sub:
      p.length > 1 ? (
        <span className="ranking-platforms">
          <span className="up">▲</span> <PlatformName name={top.platform} /> {compact(top.views)} · <span className="down">▼</span>{" "}
          <PlatformName name={low.platform} /> {compact(low.views)} · {p.length} แพลตฟอร์ม
        </span>
      ) : (
        <>
          <span className="tag">{top.platform}</span> {x.group.lead.vdoType}
        </>
      ),
  };
};

function ClipList({
  items,
  tone,
  order,
  onOpen,
}: {
  items: ListItem[];
  tone: "best" | "worst";
  order: ClipOrder;
  /** Opens the clip analysis. */
  onOpen: (row: RecordRow) => void;
}) {
  if (!items.length) {
    return <p className="ranking-empty">ไม่มีคลิปในช่วงนี้</p>;
  }
  return (
    <ol className={`ranking-list ${tone}`}>
      {items.map((x, i) => (
        <li key={`${x.key}-${i}`}>
          <b className="ranking-no">{i + 1}</b>
          <div className="ranking-body">
            <span className="ranking-title">
              <button type="button" className="clip-open" onClick={() => onOpen(x.row)} title="วิเคราะห์คลิปนี้">
                {x.row.topic || "ไม่ระบุประเด็น"}
              </button>
              {x.row.url && (
                <a href={x.row.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป" title="เปิดคลิป">
                  <ExternalLink size={11} />
                </a>
              )}
            </span>
            <small>
              {x.sub}
              {x.fresh && <span className="ranking-fresh" title="ลงไม่ถึง 2 วัน ยอดยังเพิ่มอยู่">ใหม่</span>}
            </small>
          </div>
          <div className="ranking-metric">
            <strong>{compact(x.views)}</strong>
            {order === "index" && <small className={x.index !== null && x.index < 1 ? "down" : "up"}>{indexText(x)}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const TV_SHOWN = 20;
/** Best and worst clips listed. */
const CLIPS_SHOWN = 20;

export function RankingSection({
  rows,
  rankingRows,
  dataLatestDate,
  startDate,
  endDate,
}: Pick<DashboardModel, "rows" | "rankingRows" | "dataLatestDate" | "startDate" | "endDate">) {
  const [grain, setGrain] = useState<Mode>("range");
  const [anchor, setAnchor] = useState("");
  const [allEpisodes, setAllEpisodes] = useState(false);
  // Raw views by default: by ranking a clip can sit above one with more views.
  const [order, setOrder] = useState<ClipOrder>("views");
  const [opened, setOpened] = useState<RecordRow | null>(null);
  // One line per content (its posts on every platform added up) by default, or one per post.
  const [byContent, setByContent] = useState(true);
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
  const clips = useMemo(() => {
    if (!period) return { best: [] as ListItem[], worst: [] as ListItem[], total: 0, posts: 0, baselineKind: "prior30" as const };
    if (byContent) {
      const r = rankContents(rankingRows, period, newest, CLIPS_SHOWN, order);
      return { best: r.best.map(contentItem), worst: r.worst.map(contentItem), total: r.total, posts: r.posts, baselineKind: r.baselineKind };
    }
    const r = rankClips(rankingRows, period, newest, CLIPS_SHOWN, order);
    return { best: r.best.map(postItem), worst: r.worst.map(postItem), total: r.total, posts: r.total, baselineKind: r.baselineKind };
  }, [rankingRows, period, newest, order, byContent]);
  const episodes = useMemo(() => (period ? rankEpisodes(rankingRows, period) : []), [rankingRows, period]);

  if (!period) return null;
  const atLatest = period.end >= dataLatestDate;
  // Up to 20 best-rated episodes (fewer if the range has fewer); the rest on request.
  const shown = (allEpisodes ? episodes : episodes.slice(0, TV_SHOWN)).map((x, i) => ({ x, i }));

  return (
    <section className="panel ranking-panel" id="ranking">
      {opened && <ClipDetailPanel clip={opened} allRows={rows} latestDate={newest} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>Ranking: ดีที่สุด / แย่ที่สุด<HelpLink topic="ranking" /></h2>
          <p>
            {byContent
              ? `คอนเทนต์ที่ลงใน${grain === "day" ? "วัน" : grain === "week" ? "สัปดาห์" : "ช่วง"}นี้ ${num(clips.total)} ชิ้น (${num(clips.posts)} โพสต์) · รวมยอดทุกแพลตฟอร์มโดยจับคู่จากชื่อคลิป · `
              : `คลิปที่ลงใน${grain === "day" ? "วัน" : grain === "week" ? "สัปดาห์" : "ช่วง"}นี้ ${num(clips.total)} ชิ้น · `}
            {order === "views"
              ? "เรียงตามยอดวิวจริง"
              : byContent
                ? "เรียงตามยอดรวมเทียบค่าปกติของคอนเทนต์ที่ลงจำนวนแพลตฟอร์มเท่ากัน"
                : "เรียงตามวิวเทียบค่าปกติของแพลตฟอร์มและรูปแบบเดียวกัน"}
          </p>
        </div>
        <div className="ranking-controls">
          <div className="segmented" aria-label="นับแบบ">
            <button className={byContent ? "active" : ""} onClick={() => setByContent(true)} title="รวมโพสต์ของคลิปเดียวกันทุกแพลตฟอร์มเป็นแถวเดียว">
              รวมทุกแพลตฟอร์ม
            </button>
            <button className={!byContent ? "active" : ""} onClick={() => setByContent(false)} title="1 โพสต์ = 1 แถว">
              แยกโพสต์
            </button>
          </div>
          <div className="segmented" aria-label="เรียงคลิปตาม">
            <button className={order === "views" ? "active" : ""} onClick={() => setOrder("views")} title="ยอดวิวจริง มากไปน้อย (แย่ที่สุด = น้อยไปมาก)">
              ยอดวิว
            </button>
            <button className={order === "index" ? "active" : ""} onClick={() => setOrder("index")} title="วิวเทียบค่าปกติของแพลตฟอร์มและรูปแบบเดียวกัน">
              เทียบค่าปกติ
            </button>
          </div>
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
          <ClipList items={clips.best} tone="best" order={order} onOpen={setOpened} />
        </article>
        <article>
          <h3>
            <ThumbsDown size={16} /> คลิปแย่ที่สุด
          </h3>
          <ClipList items={clips.worst} tone="worst" order={order} onOpen={setOpened} />
        </article>
        <article className="ranking-tv">
          <h3>
            <Tv size={16} /> เทปรายการทีวี (เรียงตามเรตติ้ง One31)
          </h3>
          {episodes.length ? (
            <ol className="ranking-list">
              {shown.map(({ x, i }) => (
                <li
                  key={`${x.row.date}-${x.row.program}`}
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
          {episodes.length > TV_SHOWN && (
            <button type="button" className="ranking-more" onClick={() => setAllEpisodes((v) => !v)}>
              {allEpisodes ? `แสดงเฉพาะ ${TV_SHOWN} เทปสูงสุด` : `ดูทั้งหมด ${episodes.length} เทป`}
            </button>
          )}
        </article>
      </div>
      <p className="ai-note ranking-note">
        {byContent
          ? "รวมทุกแพลตฟอร์ม: โพสต์ที่รายการเดียวกัน ชื่อคลิปเดียวกัน (ไม่นับ hashtag) และลงห่างกันไม่เกิน 3 วัน นับเป็นคอนเทนต์เดียว ถ้าตั้งชื่อต่างกันจะแยกแถว · ค่าปกติ = ค่ามัธยฐานยอดรวมของคอนเทนต์ที่ลงจำนวนแพลตฟอร์มเท่ากัน (ลงแพลตฟอร์มเดียว: เทียบกับแพลตฟอร์มและรูปแบบเดียวกัน)"
          : "ค่าปกติ = ค่ามัธยฐานยอดวิวของคลิปแพลตฟอร์มและรูปแบบเดียวกัน"}
        {clips.baselineKind === "within" ? "ภายในช่วงนี้ (ช่วงยาวกว่า 1 เดือน)" : "ใน 30 วันก่อนหน้า"} ·
        “แย่ที่สุด” ไม่นับคลิปที่ลงไม่ถึง 2 วัน และคลิปที่วิวต่ำกว่า 50 · ยอดวิวเป็นยอดสะสม ณ วันที่อัปเดตข้อมูลล่าสุด
      </p>
    </section>
  );
}
