"use client";
// รายงานประจำเดือน → one page of Affiliate (YouTube Shopping) for the report's month,
// from the imported Google Sheets (affiliateSheets, read by who may see revenue).
// Same numbers as the Affiliate Dashboard with that month picked.
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coins, PackageCheck, Percent, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import { listsFor, monthTotals, type AffiliateSheets } from "@/lib/dashboard/affiliateSheets";
import { ProductTop, RANKS } from "@/components/dashboard/sections/AffiliateDashboard";

const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (m: string) => `${TH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const baht = (v: number) => `฿${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(v || 0))}`;
const bahtShort = (v: number) => `฿${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0)}`;
const n0 = (v: number) => new Intl.NumberFormat("en-US").format(Math.round(v || 0));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** True when the sheets have the report's month (its monthly totals). */
export const hasAffiliateMonth = (data: AffiliateSheets | null, month: string) => !!data?.monthly?.some((m) => m.month === month);

export function AffiliateMonthPage({ data, month }: { data: AffiliateSheets; month: string }) {
  const year = month.slice(0, 4);
  const months = data.monthly.filter((m) => m.month.startsWith(year) && m.month <= month);
  const prevMonth = months[months.length - 2]?.month;
  const t = monthTotals(data.monthly, [month]);
  const prev = prevMonth ? monthTotals(data.monthly, [prevMonth]) : null;
  const lists = listsFor(data, [month]);
  const monthly = lists.productMonths.length > 0;
  const change = (now: number, before?: number) => (before ? (now - before) / before : null);
  const Delta = ({ v }: { v: number | null }) =>
    v === null ? null : (
      <em className={v >= 0 ? "aff2-up" : "aff2-down"}>
        {v >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {v >= 0 ? "+" : ""}
        {pct(v)} จาก {thMonth(prevMonth!)}
      </em>
    );
  const chart = months.map((m) => ({ ...m, label: thMonth(m.month), on: m.month === month }));
  return (
    <div className="aff2 aff2-month">
      <div className="aff2-month-top">
        <div className="affiliate-kpis aff2-kpis">
          <article>
            <Coins style={{ color: "#059669" }} />
            <span>ค่าคอมที่ได้ (Earned)</span>
            <strong>{baht(t.earnedRevenue)}</strong>
            <small>
              <Delta v={change(t.earnedRevenue, prev?.earnedRevenue)} />
            </small>
          </article>
          <article>
            <ShoppingCart style={{ color: "#2563eb" }} />
            <span>ยอดขายสินค้า</span>
            <strong>{baht(t.totalSales)}</strong>
            <small>
              <Delta v={change(t.totalSales, prev?.totalSales)} />
            </small>
          </article>
          <article>
            <PackageCheck style={{ color: "#7c3aed" }} />
            <span>ออเดอร์</span>
            <strong>{n0(t.orders)}</strong>
            <small>
              <Delta v={change(t.orders, prev?.orders)} />
            </small>
          </article>
          <article>
            <Percent style={{ color: "#ea580c" }} />
            <span>% ค่าคอม · ต่อออเดอร์</span>
            <strong>{pct(t.rate)}</strong>
            <small>{baht(t.perOrder)} ต่อออเดอร์</small>
          </article>
        </div>
        <article className="panel aff2-month-chart">
          <div className="panel-head">
            <div>
              <h3>
                ค่าคอมรายเดือน ปี {year} · {thMonth(month)}
              </h3>
              <p>แท่ง = ค่าคอม · เส้น = ออเดอร์</p>
            </div>
          </div>
          <div style={{ height: 136 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="b" tickFormatter={bahtShort} tick={{ fontSize: 10 }} width={48} />
                <YAxis yAxisId="o" orientation="right" tickFormatter={(v) => n0(v)} tick={{ fontSize: 10 }} width={38} />
                <Tooltip formatter={(v, name) => (name === "ออเดอร์" ? n0(Number(v)) : baht(Number(v)))} />
                <Bar yAxisId="b" dataKey="earnedRevenue" name="ค่าคอม" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {chart.map((c) => (
                    <Cell key={c.month} fill="#059669" fillOpacity={c.on ? 1 : 0.3} />
                  ))}
                </Bar>
                <Line yAxisId="o" dataKey="orders" name="ออเดอร์" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
      <p className="aff2-note">
        Top 5 สินค้าของ {thMonth(month)} {monthly ? "(จากไฟล์รายเดือน)" : "· ยังไม่มีไฟล์รายสินค้าของเดือนนี้ จึงแสดงยอดไฟล์รวม"}
      </p>
      <div className="aff2-tops">
        {RANKS.map((r) => (
          <ProductTop key={r.key} products={lists.products} rank={r} n={5} />
        ))}
      </div>
    </div>
  );
}
