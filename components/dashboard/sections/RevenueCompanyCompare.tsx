"use client";
// Revenue → "เทียบ 2 บริษัท": TERO Digital and Tero Entertainment per month,
// with the part of Overall that neither company sheet holds (lib/dashboard/revenueCompanies.ts).
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenueData } from "@/lib/dashboard/revenueParser";
import { COMPANY_LABEL, companyMonths, inCurrency, type Currency } from "@/lib/dashboard/revenueCompanies";
const moneyCompact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);

const COLORS = { digital: "#2563eb", entertainment: "#db2777", other: "#94a3b8" };
const OTHER_LABEL = "ส่วนที่ไม่อยู่ใน 2 sheet";

export function RevenueCompanyCompare({ data, year, currency = "USD" }: { data: RevenueData; year: string; currency?: Currency }) {
  const money = (v: number) =>
    new Intl.NumberFormat(currency === "THB" ? "th-TH" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(v || 0);
  // In THB each sheet is converted by the month's rate; months without a rate drop out of every sheet.
  const { rows, missing } = useMemo(() => {
    const conv = (l: RevenueData["monthly"] | undefined) => (l ? inCurrency(l, currency, data.rates) : { items: undefined, missing: [] as string[] });
    const o = conv(data.monthly);
    const d = conv(data.digital);
    const e = conv(data.entertainment);
    return {
      rows: companyMonths(o.items || [], d.items, e.items).filter((r) => year === "ALL" || String(r.year) === year),
      missing: [...new Set([...o.missing, ...d.missing, ...e.missing])],
    };
  }, [data, year, currency]);
  const chart = rows.map((r) => ({
    label: r.monthLabel,
    [COMPANY_LABEL.digital]: r.digital ?? 0,
    [COMPANY_LABEL.entertainment]: r.entertainment ?? 0,
    // Only a positive remainder can be drawn as a share of Overall; a negative one is listed in the table.
    [OTHER_LABEL]: r.other !== null && r.other > 0 ? r.other : 0,
  }));
  const sum = (k: "digital" | "entertainment" | "overall") => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  // Shares over the months that have all three, so the parts add up to Overall.
  const full = rows.filter((r) => r.overall !== null && r.digital !== null && r.entertainment !== null);
  const fullSum = (k: "digital" | "entertainment" | "other" | "overall") => full.reduce((a, r) => a + (r[k] ?? 0), 0);
  const pie = [
    { name: COMPANY_LABEL.digital, value: fullSum("digital"), color: COLORS.digital },
    { name: COMPANY_LABEL.entertainment, value: fullSum("entertainment"), color: COLORS.entertainment },
    { name: OTHER_LABEL, value: Math.max(0, fullSum("other")), color: COLORS.other },
  ].filter((x) => x.value > 0);
  const fullOverall = fullSum("overall");

  return (
    <div className="revenue-compare">
      {missing.length > 0 && <p className="growth-notice">ไม่รวม {missing.length} เดือนที่ยังไม่มีอัตรา: {missing.join(", ")}</p>}
      <div className="revenue-compare-cards">
        <article>
          <span>{COMPANY_LABEL.digital}</span>
          <strong style={{ color: COLORS.digital }}>{money(sum("digital"))}</strong>
          <small>{rows.filter((r) => r.digital !== null).length} เดือน</small>
        </article>
        <article>
          <span>{COMPANY_LABEL.entertainment}</span>
          <strong style={{ color: COLORS.entertainment }}>{money(sum("entertainment"))}</strong>
          <small>{rows.filter((r) => r.entertainment !== null).length} เดือน</small>
        </article>
        <article>
          <span>Overall (รวม)</span>
          <strong>{money(sum("overall"))}</strong>
          <small>{rows.filter((r) => r.overall !== null).length} เดือน</small>
        </article>
        <article>
          <span>{OTHER_LABEL}</span>
          <strong style={{ color: "#64748b" }}>{full.length ? money(fullSum("other")) : "-"}</strong>
          <small>Overall − 2 บริษัท · {full.length} เดือนที่มีครบ 3 sheet</small>
        </article>
      </div>

      <div className="revenue-compare-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>รายได้รายเดือนแยกบริษัท ({currency})</h3>
              <p>EST.Revenue ตามไฟล์ · แท่งสีเทา = Overall ที่ไม่อยู่ใน sheet ของ 2 บริษัท</p>
            </div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v, name) => [money(Number(v)), String(name)]} />
                <Legend />
                <Bar dataKey={COMPANY_LABEL.digital} stackId="r" fill={COLORS.digital} />
                <Bar dataKey={COMPANY_LABEL.entertainment} stackId="r" fill={COLORS.entertainment} />
                <Bar dataKey={OTHER_LABEL} stackId="r" fill={COLORS.other} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>สัดส่วนรายได้ตามบริษัท</h3>
              <p>{full.length ? `${full.length} เดือนที่มีครบ 3 sheet · รวม ${money(fullOverall)}` : "ยังไม่มีเดือนที่มีครบ 3 sheet"}</p>
            </div>
          </div>
          {pie.length ? (
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86}>
                    {pie.map((x) => (
                      <Cell key={x.name} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${money(Number(v))} (${fullOverall ? ((Number(v) / fullOverall) * 100).toFixed(1) : 0}%)`, String(name)]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="ranking-empty">ไม่มีข้อมูล</p>
          )}
        </article>
      </div>

      <article className="panel">
        <div className="panel-head">
          <div>
            <h3>ตารางรายได้รายเดือนแยกบริษัท ({currency})</h3>
            <p>ค่าดิบจากไฟล์ · “-” = ไม่มีเดือนนั้นใน sheet</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="revenue-compare-table">
            <thead>
              <tr>
                <th>เดือน</th>
                <th className="num">{COMPANY_LABEL.digital}</th>
                <th className="num">{COMPANY_LABEL.entertainment}</th>
                <th className="num">Overall</th>
                <th className="num">{OTHER_LABEL}</th>
                <th className="num">% Digital</th>
                <th className="num">% Entertainment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td>{r.monthLabel}</td>
                  <td className="num">{r.digital === null ? "-" : money(r.digital)}</td>
                  <td className="num">{r.entertainment === null ? "-" : money(r.entertainment)}</td>
                  <td className="num strong">{r.overall === null ? "-" : money(r.overall)}</td>
                  <td className={`num ${r.other !== null && r.other < 0 ? "down" : ""}`}>{r.other === null ? "-" : money(r.other)}</td>
                  <td className="num">{r.overall && r.digital !== null ? `${((r.digital / r.overall) * 100).toFixed(1)}%` : "-"}</td>
                  <td className="num">{r.overall && r.entertainment !== null ? `${((r.entertainment / r.overall) * 100).toFixed(1)}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
