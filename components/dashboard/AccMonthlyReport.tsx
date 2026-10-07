"use client";
// รายได้ → Monthly ACC: views and revenue per YouTube channel for one month, in
// the CMS "Channel summary" columns, with an Excel export. Admins only.
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { num } from "@/lib/dashboard/format";
import { track } from "@/lib/loadingBar";
import { loadAccMonths } from "@/lib/accMonthlyData";
import { recordDownload } from "@/lib/auth/activity";
import { loadRevenueDataFromFirebase } from "@/lib/firebase";
import { accSheetRows, accTotals, monthEnd, rowNote, type AccMonth, type AccNums } from "@/lib/dashboard/accMonthly";

type Currency = "USD" | "THB";
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
const thDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const thTime = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "-");

export function AccMonthlyReport({ canDownload = true }: { canDownload?: boolean }) {
  const [months, setMonths] = useState<AccMonth[] | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");
  const [currencyPicked, setCurrency] = useState<Currency>("USD");
  // Months ticked for the export; empty = the month on screen.
  const [exportMonths, setExportMonths] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    track(
      Promise.all([loadAccMonths(), loadRevenueDataFromFirebase().catch(() => null)])
        .then(([list, revenue]) => {
          setMonths(list);
          setRates(revenue?.rates || {});
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e))),
    );
  }, []);

  const month = useMemo(() => months?.find((m) => m.month === picked) || months?.[0] || null, [months, picked]);
  const rate = month ? rates[month.month] : undefined;
  const currency: Currency = rate ? currencyPicked : "USD";
  const factor = currency === "THB" ? rate! : 1;
  const money = (v: number) =>
    new Intl.NumberFormat(currency === "THB" ? "th-TH" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format((v || 0) * factor);
  const total = month ? accTotals(month.rows) : null;
  const running = !!month && month.through < monthEnd(month.month);

  /** Months that can go into the export in this currency (THB needs the month's rate). */
  const exportable = (m: string) => currency === "USD" || !!rates[m];
  const chosen = (months || []).filter((m) => (exportMonths.length ? exportMonths.includes(m.month) : m.month === month?.month) && exportable(m.month));

  function toggleExport(m: string) {
    const base = exportMonths.length ? exportMonths : month ? [month.month] : [];
    setExportMonths(base.includes(m) ? base.filter((x) => x !== m) : [...base, m]);
  }

  /** One sheet per month (oldest first), one with every month, and the notes. */
  async function exportExcel() {
    if (!chosen.length) return;
    const XLSX = await import("xlsx");
    const list = [...chosen].sort((x, y) => x.month.localeCompare(y.month));
    const factorOf = (m: string) => (currency === "THB" ? rates[m] : 1);
    const wb = XLSX.utils.book_new();
    for (const m of list) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accSheetRows(m, factorOf(m.month), currency)), m.month);
    if (list.length > 1) {
      const all = list.flatMap((m) => accSheetRows(m, factorOf(m.month), currency).map((r) => ({ Month: m.month, ...r })));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), "ทั้งหมด");
    }
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        ...list.map((m) => ({ หัวข้อ: `เดือน ${m.month}`, รายละเอียด: `ข้อมูลถึง ${m.through} · อัปเดต ${thTime(m.updatedAt)}${currency === "THB" ? ` · ${rates[m.month]} บาท/USD` : ""}` })),
        { หัวข้อ: "ที่มา", รายละเอียด: "YouTube Analytics API (CMS)" },
        { หัวข้อ: "รายได้", รายละเอียด: currency === "THB" ? "รายได้ประมาณการจาก YouTube แปลงเป็น THB ด้วยอัตราของแต่ละเดือนจากไฟล์รายได้" : "รายได้ประมาณการจาก YouTube (USD) อาจต่างจาก Channel Summary ของ CMS เล็กน้อย" },
        { หัวข้อ: "ถกไม่เถียง / เงินทองของจริง", รายละเอียด: "นับจากคลิปของรายการในช่อง TERO DIGITAL (Program ใน masterData หรือชื่อคลิป) · แถว TERO Digital = ส่วนที่เหลือของช่อง" },
        { หัวข้อ: "Ad-Enabled", รายละเอียด: "API ไม่มีตัวเลขนี้ ดูได้จากไฟล์ Channel Summary ใน CMS" },
      ]),
      "หมายเหตุ",
    );
    const name = list.length === 1 ? list[0].month : `${list[0].month}_to_${list[list.length - 1].month}`;
    XLSX.writeFile(wb, `Monthly-ACC-${name}-${currency}.xlsx`);
    recordDownload("excel-monthly-acc", `Monthly-ACC-${name}-${currency}.xlsx`, list.length);
    setExportOpen(false);
  }

  const blank = (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <td key={i} className="num muted">-</td>
      ))}
    </>
  );
  const cells = (r: AccNums) => (
    <>
      <td className="num">{num(r.premiumViews)}</td>
      <td className="num strong">{num(r.views)}</td>
      <td className="num">{num(r.watchPage)}</td>
      <td className="num">{num(r.embedded)}</td>
      <td className="num">{num(r.channelPage)}</td>
      <td className="num">{num(r.live)}</td>
      <td className="num">{num(r.onDemand)}</td>
      <td className="num muted">-</td>
      <td className="num strong">{money(r.adRevenue)}</td>
      <td className="num">{money(r.premiumRevenue)}</td>
    </>
  );

  return (
    <section className="panel growth-panel yt-deep acc-monthly" id="monthly-acc">
      <div className="panel-head">
        <div>
          <h2>
            <FileSpreadsheet size={18} /> Monthly ACC
          </h2>
          <p className="growth-sub">
            ยอดวิวและรายได้รายเดือนต่อช่อง YouTube จาก CMS (YouTube Analytics API) · รายได้เป็นยอดประมาณการ · อัปเดต {thTime(month?.updatedAt || "")}
          </p>
        </div>
      </div>

      {error && <p className="growth-notice">โหลดข้อมูลไม่ได้: {error}</p>}
      {!error && months === null && <p className="growth-notice">กำลังโหลด…</p>}
      {!error && months && !months.length && <p className="growth-notice">ยังไม่มีข้อมูล ระบบจะเริ่มเก็บในการ sync รอบถัดไป</p>}

      {month && total && (
        <>
          <div className="acc-toolbar">
            <select className="yt-curve-pick" value={month.month} onChange={(e) => setPicked(e.target.value)} aria-label="เดือน">
              {months!.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month)}
                </option>
              ))}
            </select>
            <div className="segmented" aria-label="สกุลเงิน">
              {(["USD", "THB"] as const).map((c) => (
                <button key={c} className={currency === c ? "active" : ""} disabled={c === "THB" && !rate} title={c === "THB" && !rate ? "ยังไม่มีอัตราแลกเปลี่ยนของเดือนนี้ในไฟล์รายได้" : undefined} onClick={() => setCurrency(c)}>
                  {c}
                </button>
              ))}
            </div>
            {canDownload && (
            <div className="acc-export-wrap">
              <button type="button" className="acc-export" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen}>
                <Download size={15} /> Export Excel
              </button>
              {exportOpen && (
                <div className="acc-export-panel" role="dialog" aria-label="เลือกเดือนที่จะ export">
                  <strong>เลือกเดือนที่จะ export ({currency})</strong>
                  <div className="acc-export-actions">
                    <button type="button" onClick={() => setExportMonths(months!.filter((m) => exportable(m.month)).map((m) => m.month))}>เลือกทั้งหมด</button>
                    <button type="button" onClick={() => setExportMonths(month ? [month.month] : [])}>เฉพาะเดือนที่ดูอยู่</button>
                  </div>
                  <ul>
                    {months!.map((m) => (
                      <li key={m.month}>
                        <label className={exportable(m.month) ? "" : "off"} title={exportable(m.month) ? undefined : "ยังไม่มีอัตราแลกเปลี่ยนของเดือนนี้ในไฟล์รายได้"}>
                          <input type="checkbox" disabled={!exportable(m.month)} checked={chosen.some((x) => x.month === m.month)} onChange={() => toggleExport(m.month)} />
                          {monthLabel(m.month)}
                          {m.through < monthEnd(m.month) && <small> (ถึง {thDay(m.through)})</small>}
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="acc-export" disabled={!chosen.length} onClick={exportExcel}>
                    <Download size={15} /> ดาวน์โหลด {chosen.length} เดือน
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
          {running && <p className="acc-note">เดือนนี้ยังไม่จบ ตัวเลขถึงวันที่ {thDay(month.through)} และจะอัปเดตทุกวัน</p>}
          {!running && <p className="acc-note">ข้อมูลครบเดือน (ถึง {thDay(month.through)}) · YouTube อาจปรับรายได้ย้อนหลังได้ราว 2 สัปดาห์ ระบบจึงอัปเดตเดือนก่อนให้ด้วย</p>}

          <div className="yt-deep-cards">
            <article>
              <span>Owned Views</span>
              <strong>{num(total.views)}</strong>
              <small>{month.rows.length} รายการ{month.rows.some((r) => r.missing) ? ` · ไม่พบใน CMS ${month.rows.filter((r) => r.missing).length}` : ""}</small>
            </article>
            <article>
              <span>YouTube Premium views</span>
              <strong>{num(total.premiumViews)}</strong>
            </article>
            <article>
              <span>Ads Partner Revenue</span>
              <strong>{money(total.adRevenue)}</strong>
            </article>
            <article>
              <span>YouTube Premium partner revenue</span>
              <strong>{money(total.premiumRevenue)}</strong>
            </article>
          </div>

          <article className="growth-table">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Channel Display Name</th>
                    <th className="num">YouTube Premium views</th>
                    <th className="num">Owned Views</th>
                    <th className="num">Watch Page</th>
                    <th className="num">Embedded Player</th>
                    <th className="num">Channel Page</th>
                    <th className="num">Live</th>
                    <th className="num">On Demand</th>
                    <th className="num" title="API ไม่มีตัวเลขนี้">Ad-Enabled</th>
                    <th className="num">Ads Partner Revenue ({currency})</th>
                    <th className="num">YouTube Premium partner revenue ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {month.rows.map((r) => (
                    <tr key={r.name} className={r.missing ? "acc-missing" : r.program ? "acc-program" : ""}>
                      <td>
                        {r.name}
                        <small className="acc-id">{r.missing ? "ไม่พบช่องนี้ใน CMS ที่เชื่อมต่อ" : r.channelId}</small>
                        {!r.missing && rowNote(r) && <small className="acc-id">{rowNote(r)}</small>}
                      </td>
                      {r.missing ? blank : cells(r)}
                    </tr>
                  ))}
                  <tr className="acc-total">
                    <td>รวม</td>
                    {cells(total)}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
          <p className="acc-note">
            Watch Page / Embedded Player / Channel Page = แหล่งที่เล่นตาม YouTube (หน้าดูวิดีโอ / ฝังบนเว็บอื่น / หน้าช่อง) ส่วนที่เหลือมาจากหน้า Shorts, หน้าแรก และอื่นๆ จึงรวมกันไม่เท่า Owned Views · ถกไม่เถียง / เงินทองของจริง นับจากคลิปของรายการในช่อง TERO DIGITAL (Program ใน masterData หรือชื่อคลิป) และแถว TERO Digital คือส่วนที่เหลือของช่อง · Ad-Enabled ไม่มีใน API
          </p>
        </>
      )}
    </section>
  );
}
