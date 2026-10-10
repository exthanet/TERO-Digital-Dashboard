"use client";
// วิเคราะห์เชิงลึก → รายงานรายแพลตฟอร์ม: one platform at a time (lib/dashboard/platformReport.ts):
// a board in the platform's own look (PlatformStudio.tsx), headline numbers against the comparison period, VDO type mix, posting weekday ×
// hour, and the best / worst clips. TV shows ratings instead. Filters at the top
// apply, except the platform filter (picked here).
import { Fragment, useMemo, useState } from "react";
import { BarChart3, ExternalLink, Hash, ThumbsDown, Trophy } from "lucide-react";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { rankClips, rankEpisodes, type ClipOrder, type RankedClip } from "@/lib/dashboard/ranking";
import {
  MIN_POSTS_PER_CELL,
  MIN_POSTS_PER_TAG,
  hashtagStats,
  REPORT_PLATFORMS,
  WEEKDAYS,
  bestSlots,
  formatMix,
  inRange,
  postingHeatmap,
} from "@/lib/dashboard/platformReport";
import { PlatformStudio, TvStudio } from "@/components/dashboard/sections/PlatformStudio";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";

type Platform = (typeof REPORT_PLATFORMS)[number];
const SHOWN = 10;
const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

interface Props {
  /** Rows passing the filters except platform and date. */
  rows: RecordRow[];
  /** Every row, for the clip analysis panel. */
  allRows: RecordRow[];
  startDate: string;
  endDate: string;
  comparePeriod: { start: string; end: string } | null;
  latestDate: string;
  /** The platform filter at the top, used as the first pick. */
  platformFilter: string;
  /** YouTube Analytics boxes (watch time, subscribers, retention, traffic sources). */
  canDeepDive: boolean;
}

export function PlatformReportSection({ rows, allRows, startDate, endDate, comparePeriod, latestDate, platformFilter, canDeepDive }: Props) {
  const [picked, setPicked] = useState<Platform>(() => (REPORT_PLATFORMS as readonly string[]).includes(platformFilter) ? (platformFilter as Platform) : "YouTube");
  const [order, setOrder] = useState<ClipOrder>("views");
  const [opened, setOpened] = useState<RecordRow | null>(null);
  const [tagSort, setTagSort] = useState<"posts" | "median">("posts");
  const [openTag, setOpenTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState(false);
  const isTv = picked === "TV";
  const color = PLATFORM_COLORS[picked] || "#475569";

  const mine = useMemo(() => rows.filter((r) => r.platform === picked), [rows, picked]);
  const cur = useMemo(() => inRange(mine, startDate, endDate), [mine, startDate, endDate]);
  const prev = useMemo(() => (comparePeriod ? inRange(mine, comparePeriod.start, comparePeriod.end) : []), [mine, comparePeriod]);
  const compareText = comparePeriod ? `เทียบ ${thDate(comparePeriod.start)} – ${thDate(comparePeriod.end)}` : "";

  const formats = useMemo(() => (isTv ? [] : formatMix(cur)), [cur, isTv]);
  const heat = useMemo(() => postingHeatmap(cur), [cur]);
  const slots = useMemo(() => bestSlots(heat), [heat]);
  const ranked = useMemo(
    () => (isTv || !startDate || !endDate ? null : rankClips(mine, { start: startDate, end: endDate }, latestDate, SHOWN, order)),
    [mine, startDate, endDate, latestDate, order, isTv],
  );
  const episodes = useMemo(() => (isTv && startDate && endDate ? rankEpisodes(mine, { start: startDate, end: endDate }) : []), [mine, startDate, endDate, isTv]);
  const tags = useMemo(() => (isTv ? null : hashtagStats(cur)), [cur, isTv]);
  const tagList = useMemo(
    () => (tags ? [...tags.tags].sort((a, b) => (tagSort === "median" ? b.medianViews - a.medianViews : b.posts - a.posts || b.views - a.views)) : []),
    [tags, tagSort],
  );
  const heatMax = Math.max(0, ...heat.cells.flat().map((c) => c.medianViews || 0));

  return (
    <section className="panel platform-report" id="platform-report">
      {opened && <ClipDetailPanel clip={opened} allRows={allRows} latestDate={latestDate} onClose={() => setOpened(null)} />}
      <div className="panel-head">
        <div>
          <h2>
            <BarChart3 size={18} /> รายงานรายแพลตฟอร์ม
          </h2>
          <p className="growth-sub">
            {thDate(startDate)} – {thDate(endDate)} · ตามตัวกรองด้านบน (ยกเว้นแพลตฟอร์ม ซึ่งเลือกที่นี่){compareText ? ` · % ${compareText}` : ""}
          </p>
        </div>
      </div>

      <div className="segmented platform-report-tabs" aria-label="แพลตฟอร์ม">
        {REPORT_PLATFORMS.map((p) => (
          <button key={p} className={picked === p ? "active" : ""} onClick={() => setPicked(p)} style={picked === p ? { color: PLATFORM_COLORS[p] } : undefined}>
            {p}
          </button>
        ))}
      </div>

      {!cur.length && <p className="growth-notice">ไม่มีข้อมูล {picked} ในช่วงและตัวกรองนี้</p>}

      {cur.length > 0 && !isTv && (
        <>
          <PlatformStudio
            platform={picked as "YouTube" | "TikTok" | "Facebook" | "Instagram"}
            cur={cur}
            prev={prev}
            mine={mine}
            startDate={startDate}
            endDate={endDate}
            latestDate={latestDate}
            compareText={compareText}
            canDeepDive={canDeepDive}
            onOpen={setOpened}
          />

          <div className={formats.length > 1 ? "platform-report-grid" : ""}>
            {/* One type only (TikTok): nothing to compare. */}
            {formats.length > 1 && (
              <article className="growth-table">
                <h3>รูปแบบคลิป (VDO Type)</h3>
                <p className="growth-hint">แถบเทา = สัดส่วนจำนวนโพสต์ · แถบสี = สัดส่วนวิว · ถ้าแถบสียาวกว่าเทา รูปแบบนั้นได้วิวเกินจำนวนที่ลง</p>
                <ul className="platform-mix">
                  {formats.map((f) => (
                    <li key={f.vdoType}>
                      <div className="platform-mix-head">
                        <b>{f.vdoType}</b>
                        <span>
                          {num(f.posts)} โพสต์ · ค่ากลาง {f.medianViews === null ? "-" : compact(f.medianViews)} วิว/โพสต์
                        </span>
                      </div>
                      <div className="platform-mix-bars">
                        <span className="posts" style={{ width: pct(f.postShare) }} title={`โพสต์ ${pct(f.postShare)}`} />
                        <span className="views" style={{ width: pct(f.viewShare), background: color }} title={`วิว ${pct(f.viewShare)}`} />
                      </div>
                      <small>
                        โพสต์ {pct(f.postShare, 0)} · วิว {pct(f.viewShare, 0)}
                      </small>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            <article className="growth-table">
              <h3>วันและเวลาโพสต์</h3>
              <p className="growth-hint">
                สี = ค่ากลางวิวต่อโพสต์ที่ลงวันและชั่วโมงนั้น (ต้องมีอย่างน้อย {MIN_POSTS_PER_CELL} โพสต์) · ตัวเลข = จำนวนโพสต์
                {heat.noTime > 0 && ` · ไม่มีเวลาโพสต์ ${num(heat.noTime)} โพสต์`}
              </p>
              {slots.length > 0 && (
                <p className="platform-slots">
                  ดีที่สุด:{" "}
                  {slots.map((s, i) => (
                    <span key={i}>
                      {WEEKDAYS[s.day]} {hh(s.hour)} ({compact(s.medianViews)} วิว · {s.posts} โพสต์)
                    </span>
                  ))}
                </p>
              )}
              <div className="table-scroll">
                <table className="platform-heat">
                  <thead>
                    <tr>
                      <th />
                      {Array.from({ length: 24 }, (_, h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.cells.map((row, d) => (
                      <tr key={d}>
                        <th>{WEEKDAYS[d]}</th>
                        {row.map((c, h) => (
                          <td
                            key={h}
                            className={c.medianViews === null ? (c.posts ? "few" : "none") : ""}
                            style={c.medianViews !== null && heatMax ? { background: `color-mix(in srgb, ${color} ${Math.round(15 + (c.medianViews / heatMax) * 85)}%, white)` } : undefined}
                            title={`${WEEKDAYS[d]} ${hh(h)} · ${c.posts} โพสต์${c.medianViews !== null ? ` · ค่ากลาง ${num(c.medianViews)} วิว` : c.posts ? " · น้อยเกินไปที่จะสรุป" : ""}`}
                          >
                            {c.posts || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="audience-note">เวลาโพสต์เป็นเวลาไทยตามที่บันทึก · เป็นความสัมพันธ์จากข้อมูล ควรทดลองยืนยันก่อนเปลี่ยนแผน</p>
            </article>
          </div>

          {tags && (
            <article className="growth-table platform-tags">
              <div className="platform-report-head">
                <h3>
                  <Hash size={15} /> Hashtag
                </h3>
                <div className="segmented" aria-label="เรียง hashtag">
                  {(
                    [
                      ["posts", "ใช้บ่อย"],
                      ["median", "วิวต่อโพสต์"],
                    ] as const
                  ).map(([k, label]) => (
                    <button key={k} className={tagSort === k ? "active" : ""} onClick={() => setTagSort(k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="growth-hint">
                มี hashtag {num(tags.withTags)} จาก {num(tags.total)} โพสต์ · แสดงเฉพาะ hashtag ที่ใช้อย่างน้อย {MIN_POSTS_PER_TAG} โพสต์ · เทียบค่าปกติ = วิวต่อโพสต์ (ค่ากลาง) ของ hashtag ÷ ของ {picked} ทั้งหมดในช่วงนี้ · กดแถวเพื่อดูคลิป
              </p>
              {tagList.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Hashtag</th>
                        <th className="num">โพสต์</th>
                        <th className="num">วิวรวม</th>
                        <th className="num">วิว/โพสต์ (ค่ากลาง)</th>
                        <th className="num">เทียบค่าปกติ</th>
                        <th className="num">ER</th>
                        <th className="num" title="สัดส่วนโพสต์ที่ใส่ hashtag นี้ในชื่อคลิป (ที่เหลืออยู่ในแคปชัน / description)">อยู่ในชื่อ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allTags ? tagList : tagList.slice(0, 15)).map((t) => (
                        <Fragment key={t.tag}>
                          <tr className="platform-tag-row" onClick={() => setOpenTag(openTag === t.tag ? null : t.tag)} aria-expanded={openTag === t.tag}>
                            <td>
                              <b>{t.tag}</b>
                            </td>
                            <td className="num">{num(t.posts)}</td>
                            <td className="num">{compact(t.views)}</td>
                            <td className="num strong">{compact(t.medianViews)}</td>
                            <td className={`num ${t.index === null ? "" : t.index >= 1 ? "up" : "down"}`}>{t.index === null ? "-" : t.index >= 1 ? `${t.index.toFixed(1)}×` : `${Math.round(t.index * 100)}%`}</td>
                            <td className="num">{pct(t.er, 2)}</td>
                            <td className="num">{pct(t.inTitle, 0)}</td>
                          </tr>
                          {openTag === t.tag && (
                            <tr className="platform-tag-clips">
                              <td colSpan={7}>
                                <ol>
                                  {t.rows.slice(0, 10).map((r, i) => (
                                    <li key={`${r.url || r.topic}-${i}`}>
                                      <button type="button" className="clip-open" onClick={() => setOpened(r)} title="วิเคราะห์คลิปนี้">
                                        {r.topic || "ไม่ระบุประเด็น"}
                                      </button>
                                      <small>
                                        {compact(r.views)} วิว · {thDate(r.date)}
                                      </small>
                                    </li>
                                  ))}
                                </ol>
                                {t.rows.length > 10 && <small>และอีก {num(t.rows.length - 10)} คลิป · ค้นหา {t.tag} ในช่องค้นหาด้านบนเพื่อดูทั้งหมด</small>}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="growth-notice">ยังไม่มี hashtag ที่ใช้ถึง {MIN_POSTS_PER_TAG} โพสต์ในช่วงนี้{tags.withTags === 0 ? " (ระบบเริ่มเก็บ hashtag ตั้งแต่ sync รอบถัดไป)" : ""}</p>
              )}
              {tagList.length > 15 && (
                <button type="button" className="ranking-more" onClick={() => setAllTags((v) => !v)}>
                  {allTags ? "แสดงน้อยลง" : `ดูทั้งหมด ${tagList.length} hashtag`}
                </button>
              )}
            </article>
          )}

          <div className="platform-report-head">
            <h3>คลิปดีที่สุด / แย่ที่สุด {SHOWN} อันดับ</h3>
            <div className="segmented" aria-label="เรียงตาม">
              {(
                [
                  ["views", "ยอดวิว"],
                  ["index", "เทียบค่าปกติ"],
                ] as const
              ).map(([o, label]) => (
                <button key={o} className={order === o ? "active" : ""} onClick={() => setOrder(o)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {ranked && (
            <div className="ranking-grid">
              <ClipList title="ดีที่สุด" icon={<Trophy size={15} />} items={ranked.best} tone="best" order={order} onOpen={setOpened} />
              <ClipList title="แย่ที่สุด" icon={<ThumbsDown size={15} />} items={ranked.worst} tone="worst" order={order} onOpen={setOpened} />
            </div>
          )}
          <p className="audience-note">
            เทียบค่าปกติ = วิว ÷ ค่ากลางวิวของ {picked} รูปแบบเดียวกัน{ranked?.baselineKind === "within" ? "ในช่วงนี้" : "ใน 30 วันก่อนช่วงนี้"} · “แย่ที่สุด” ไม่รวมคลิปที่ลงไม่ถึง 2 วันและคลิปที่วิวต่ำกว่า 50
          </p>
        </>
      )}

      {cur.length > 0 && isTv && (
        <>
          <TvStudio cur={cur} prev={prev} mine={mine} startDate={startDate} endDate={endDate} compareText={compareText} />
          <article className="growth-table">
            <h3>เทปที่เรตติ้งสูงสุด / ต่ำสุด</h3>
            <div className="ranking-grid">
              <EpisodeList title="สูงสุด" icon={<Trophy size={15} />} items={episodes.slice(0, SHOWN)} />
              <EpisodeList title="ต่ำสุด" icon={<ThumbsDown size={15} />} items={episodes.length > SHOWN ? [...episodes].reverse().slice(0, SHOWN) : []} />
            </div>
            <p className="audience-note">% = เรตติ้งเทปนั้นเทียบค่าเฉลี่ย 28 วันก่อนช่วงนี้ · รายละเอียดเรตติ้งแยกภาคอยู่ในหน้าภาพรวม → TV Rating</p>
          </article>
        </>
      )}
    </section>
  );
}

function ClipList({ title, icon, items, tone, order, onOpen }: { title: string; icon: React.ReactNode; items: RankedClip[]; tone: "best" | "worst"; order: ClipOrder; onOpen: (r: RecordRow) => void }) {
  return (
    <article className={`ranking-card ${tone}`}>
      <h3>
        {icon} {title}
      </h3>
      {items.length ? (
        <ol className={`ranking-list ${tone}`}>
          {items.map((x, i) => (
            <li key={`${x.row.contentId || x.row.url || x.row.topic}-${i}`}>
              <b className="ranking-no">{i + 1}</b>
              <div className="ranking-body">
                <span className="ranking-title">
                  <button type="button" className="clip-open" onClick={() => onOpen(x.row)} title="วิเคราะห์คลิปนี้">
                    {x.row.topic || "ไม่ระบุประเด็น"}
                  </button>
                  {x.row.url && (
                    <a href={x.row.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป">
                      <ExternalLink size={11} />
                    </a>
                  )}
                </span>
                <small>
                  {x.row.vdoType} · {thDate(x.row.date)}
                  {x.fresh && <span className="ranking-fresh" title="ลงไม่ถึง 2 วัน ยอดยังเพิ่มอยู่">ใหม่</span>}
                </small>
              </div>
              <div className="ranking-metric">
                <strong>{compact(x.row.views)}</strong>
                {order === "index" && (
                  <small className={x.index !== null && x.index < 1 ? "down" : "up"}>
                    {x.index === null ? "ไม่มีค่าปกติ" : x.index >= 1 ? `${x.index.toFixed(1)}× ของค่าปกติ` : `${Math.round(x.index * 100)}% ของค่าปกติ`}
                  </small>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">ไม่มีคลิปในช่วงนี้</p>
      )}
    </article>
  );
}

function EpisodeList({ title, icon, items }: { title: string; icon: React.ReactNode; items: ReturnType<typeof rankEpisodes> }) {
  return (
    <article className="ranking-card">
      <h3>
        {icon} {title}
      </h3>
      {items.length ? (
        <ol className="ranking-list">
          {items.map((x, i) => (
            <li key={`${x.row.date}-${x.row.topic}-${i}`}>
              <b className="ranking-no">{i + 1}</b>
              <div className="ranking-body">
                <span className="ranking-title">{x.row.topic || x.row.episodeId || "ไม่ระบุ"}</span>
                <small>
                  {x.row.program} · {thDate(x.row.date)}
                </small>
              </div>
              <div className="ranking-metric">
                <strong>{x.row.ratingTotal.toFixed(3)}</strong>
                {x.vsAverage !== null && <small className={x.vsAverage < 0 ? "down" : "up"}>{`${x.vsAverage >= 0 ? "+" : ""}${Math.round(x.vsAverage * 100)}%`}</small>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">เทปไม่พอสำหรับรายการต่ำสุด</p>
      )}
    </article>
  );
}
