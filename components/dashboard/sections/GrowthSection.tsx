"use client";
// Advanced → การเติบโต: views gained per day (growthDaily, see lib/dashboard/growth.ts),
// for the posts that pass the dashboard filters (program, platform, type, search).
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ExternalLink, History, MousePointerClick, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecordRow } from "@/lib/dashboard/types";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { GROWTH_MAX_DAYS, daysBetween, summarizeGrowth, type GrowthEntry } from "@/lib/dashboard/growth";
import { firstGrowthDay, loadGrowthDays } from "@/lib/growthData";
import { Kpi } from "@/components/dashboard/shared/Kpi";
import { Growth } from "@/components/dashboard/shared/Growth";
import { HelpLink } from "@/components/dashboard/sections/HelpSection";
import { ClipDetailPanel } from "@/components/dashboard/sections/ClipDetailPanel";
import { track } from "@/lib/loadingBar";

const thDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`)) : "";

interface Props {
  /** Rows that pass the dashboard filters, ignoring the date filter (gains are dated by when they happened). */
  rows: RecordRow[];
  /** Every row, to find a clip's posts on other platforms whatever the filters. */
  allRows: RecordRow[];
  startDate: string;
  endDate: string;
  comparePeriod: { start: string; end: string } | null;
}

export function GrowthSection({ rows, allRows, startDate, endDate, comparePeriod }: Props) {
  const [firstDay, setFirstDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [opened, setOpened] = useState<RecordRow | null>(null);

  const rangeDays = useMemo(() => (startDate && endDate ? daysBetween(startDate, endDate) : []), [startDate, endDate]);
  const prevDays = useMemo(
    () => (comparePeriod ? daysBetween(comparePeriod.start, comparePeriod.end) : []),
    [comparePeriod],
  );
  const tooLong = rangeDays.length > GROWTH_MAX_DAYS;
  const requestKey = `${startDate}|${endDate}|${comparePeriod?.start}|${comparePeriod?.end}`;

  useEffect(() => {
    track(firstGrowthDay())
      .then(setFirstDay)
      .catch(() => setFirstDay(""));
  }, []);

  // Raw days for the range (and the compare range); summaries follow the filters below.
  const [days, setDays] = useState<{ key: string; map: Map<string, GrowthEntry[] | null> } | null>(null);
  useEffect(() => {
    if (!rangeDays.length || tooLong) return;
    let alive = true;
    setError("");
    const wanted = [...new Set([...rangeDays, ...(prevDays.length <= GROWTH_MAX_DAYS ? prevDays : [])])];
    track(loadGrowthDays(wanted))
      .then((map) => alive && setDays({ key: requestKey, map }))
      .catch((e) => alive && setError(String(e?.message || e)));
    return () => {
      alive = false;
    };
  }, [requestKey, rangeDays, prevDays, tooLong]);

  const ready = !!days && days.key === requestKey;
  const s = useMemo(
    () => (ready ? summarizeGrowth(rangeDays, days!.map, rows, startDate) : null),
    [ready, days, rangeDays, rows, startDate],
  );
  const p = useMemo(() => {
    if (!ready || !comparePeriod || !prevDays.length || !prevDays.every((d) => days!.map.has(d))) return null;
    return summarizeGrowth(prevDays, days!.map, rows, comparePeriod.start);
  }, [ready, days, prevDays, rows, comparePeriod]);
  // Compare only when both ranges are fully covered by growth data.
  const comparable = !!(s && p && s.daysWithData === rangeDays.length && p.daysWithData === prevDays.length);
  const change = (a: number, b: number) => (comparable && b ? (a - b) / Math.abs(b) : null);
  const compareText = comparePeriod ? `เทียบกับ ${thDate(comparePeriod.start)} – ${thDate(comparePeriod.end)}` : "";

  const clips = s ? (showAll ? s.clips.slice(0, 100) : s.clips.slice(0, 20)) : [];

  return (
    <section className="panel growth-panel" id="growth">
      {opened && ready && (
        <ClipDetailPanel clip={opened} allRows={allRows} days={days!.map} rangeDays={rangeDays} onClose={() => setOpened(null)} />
      )}
      <div className="panel-head">
        <div>
          <h2>การเติบโต: ยอดที่เพิ่มขึ้นจริงในช่วงนี้<HelpLink topic="growth" /></h2>
          <p className="growth-sub">
            นับวิวที่เกิดขึ้นในช่วง {thDate(startDate)} – {thDate(endDate)} ของทุกคลิป รวมคลิปที่โพสต์ก่อนหน้า
            (ต่างจากหน้ารายงานที่นับยอดสะสมของคลิปที่โพสต์ในช่วงนี้)
          </p>
        </div>
      </div>

      {firstDay !== null && (
        <p className="growth-notice">
          <History size={15} />
          {firstDay
            ? `มีข้อมูลรายวันตั้งแต่ ${thDate(firstDay)} · ช่วงก่อนหน้านั้นยังไม่มีข้อมูล`
            : "ยังไม่มีข้อมูลรายวัน · ระบบจะเริ่มเก็บจากการ sync รอบถัดไป (ทุกวัน 05:17 น.)"}
        </p>
      )}

      {tooLong && <p className="growth-notice warn">ช่วงวันที่ยาวเกิน {GROWTH_MAX_DAYS} วัน กรุณาเลือกช่วงที่สั้นลง (เช่น 28 หรือ 90 วันล่าสุด)</p>}
      {error && <p className="growth-notice warn">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {!tooLong && !error && !ready && <p className="growth-notice">กำลังโหลดข้อมูลรายวัน…</p>}

      {s && s.daysWithData === 0 && (
        <p className="growth-notice warn">ยังไม่มีข้อมูลรายวันในช่วงวันที่ที่เลือก</p>
      )}

      {s && s.daysWithData > 0 && (
        <>
          {s.daysWithData < rangeDays.length && (
            <p className="growth-notice">
              มีข้อมูล {s.daysWithData} จาก {rangeDays.length} วันในช่วงนี้ ตัวเลขด้านล่างนับเฉพาะวันที่มีข้อมูล
              {comparePeriod && " (ไม่แสดง % เปรียบเทียบเพราะข้อมูลไม่ครบช่วง)"}
            </p>
          )}

          <div className="kpi-grid growth-kpis">
            <Kpi
              tone="blue"
              icon={<TrendingUp />}
              label="วิวที่เพิ่มขึ้นในช่วงนี้"
              value={compact(s.views)}
              growth={<Growth value={change(s.views, p?.views || 0)} title={compareText} />}
              detail={`เฉลี่ย ${compact(s.daysWithData ? s.views / s.daysWithData : 0)} วิว/วัน`}
            />
            <Kpi
              tone="indigo"
              icon={<MousePointerClick />}
              label="Engagement ที่เพิ่มขึ้น"
              value={compact(s.engagement)}
              growth={<Growth value={change(s.engagement, p?.engagement || 0)} title={compareText} />}
              detail="ไลก์ + คอมเมนต์ + แชร์"
            />
            <Kpi
              tone="green"
              icon={<Activity />}
              label="คลิปที่มีวิวเพิ่ม"
              value={num(s.clipsGaining)}
              growth={<Growth value={change(s.clipsGaining, p?.clipsGaining || 0)} title={compareText} />}
              detail="จำนวนคลิปที่ยังมีคนดูในช่วงนี้"
            />
            <Kpi
              tone="orange"
              icon={<History />}
              label="วิวจากคลิปที่โพสต์ก่อนช่วงนี้"
              value={s.views > 0 ? `${((s.viewsFromOlder / s.views) * 100).toFixed(1)}%` : "-"}
              detail={`${compact(s.viewsFromOlder)} วิว จากคลิปเก่าที่ยังมีคนดู`}
            />
          </div>

          <article className="growth-chart">
            <h3>วิวที่เพิ่มขึ้นแต่ละวัน แยกตามแพลตฟอร์ม</h3>
            <div className="growth-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => thDate(d, { day: "numeric", month: "short" })} fontSize={11} />
                  <YAxis tickFormatter={(v: number) => compact(v)} fontSize={11} width={48} />
                  <Tooltip
                    labelFormatter={(d) => thDate(String(d), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    formatter={(v) => num(Number(v))}
                  />
                  <Legend />
                  {s.platforms.map((pl) => (
                    <Bar key={pl} dataKey={pl} stackId="v" fill={PLATFORM_COLORS[pl] || "#64748b"} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="growth-table">
            <h3>คลิปที่วิวเพิ่มมากที่สุดในช่วงนี้</h3>
            <p className="growth-hint">กดชื่อคลิปเพื่อดูการวิเคราะห์คลิปนั้น (ทุกแพลตฟอร์ม วิวรายวัน ช่วงเวลาโพสต์)</p>
            {clips.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>คลิป</th>
                      <th>โพสต์เมื่อ</th>
                      <th className="num">วิวที่เพิ่ม</th>
                      <th className="num">Engagement ที่เพิ่ม</th>
                      <th className="num">วิวสะสมล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clips.map((c, i) => (
                      <tr key={c.key}>
                        <td>{i + 1}</td>
                        <td className="growth-clip">
                          <span className="growth-clip-title">
                            <button type="button" className="clip-open" onClick={() => setOpened(c.row)} title="วิเคราะห์คลิปนี้">
                              {c.row.topic || "ไม่ระบุประเด็น"}
                            </button>
                            {c.row.url && (
                              <a href={c.row.url} target="_blank" rel="noreferrer" aria-label="เปิดคลิป" title="เปิดคลิป">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                          <small>
                            <span className="tag">{c.row.platform}</span> {c.row.vdoType}
                            {c.row.date < startDate && <span className="growth-tag old">คลิปเก่า</span>}
                            {c.dropped && (
                              <span className="growth-tag drop" title="มีบางวันที่ตัวเลขจาก API ลดลง (แสดงตามจริง)">
                                <AlertTriangle size={11} /> ตัวเลขลดลง
                              </span>
                            )}
                          </small>
                        </td>
                        <td>{thDate(c.row.date, { day: "numeric", month: "short", year: "2-digit" })}</td>
                        <td className="num strong">{num(c.views)}</td>
                        <td className="num">{num(c.likes + c.comments + c.shares)}</td>
                        <td className="num">{num(c.row.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ranking-empty">ไม่มีคลิปที่มีวิวเพิ่มในช่วงนี้</p>
            )}
            {s.clips.length > 20 && (
              <button type="button" className="ranking-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "แสดง 20 อันดับ" : `แสดงเพิ่ม (สูงสุด 100 จาก ${num(s.clips.length)} คลิป)`}
              </button>
            )}
          </article>

          <p className="ai-note growth-note">
            วิธีนับ: ระบบ sync ทุกเช้า 05:17 น. ยอดที่เพิ่มของวันหนึ่ง = ตัวเลขรอบเช้าวันถัดไป − ตัวเลขรอบเช้าวันนั้น
            (ค่าดิบจาก API ไม่มีการปรับ) · คลิปใหม่นับจาก 0 · ไม่รวม TV · นับเฉพาะคลิปที่โพสต์ใน 90 วันล่าสุดของแต่ละวัน
            (คลิปเก่ากว่านั้นไม่ถูกอัปเดตทุกวัน) · Facebook Post นับวิวเป็นจำนวนการเห็น
            {s.drops > 0 && ` · มี ${num(s.drops)} รายการที่ตัวเลขลดลง แสดงตามจริงและทำเครื่องหมายไว้`}
          </p>
        </>
      )}
    </section>
  );
}
