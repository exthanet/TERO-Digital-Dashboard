"use client";
// Affiliate Report → "Affiliate Dashboard": the three YouTube Studio exports kept in
// Google Sheets (lib/dashboard/affiliateSheets.ts), summed up. The month filter
// works on the monthly and daily numbers; product and content lists cover the
// period their export covers (shown on each list).
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from "recharts";
import { Award, Coins, PackageCheck, Percent, ShoppingCart, TrendingDown, TrendingUp, Video } from "lucide-react";
import { listsFor, monthTotals, topProducts, type AffiliateSheets, type AffProduct, type ProductRank } from "@/lib/dashboard/affiliateSheets";
import { useMotion } from "@/components/dashboard/shared/Motion";

const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (m: string) => `${TH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const thDay = (d: string) => (d ? `${Number(d.slice(8, 10))} ${TH[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}` : "");
const baht = (v: number) => `฿${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(v || 0))}`;
const bahtShort = (v: number) => `฿${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0)}`;
const n0 = (v: number) => new Intl.NumberFormat("en-US").format(Math.round(v || 0));
/** The dashboard starts here; earlier months in the sheets are not shown. */
const FIRST_MONTH = "2026-01";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const RANKS: { key: ProductRank; title: string; hint: string; Icon: typeof Award }[] = [
  { key: "orders", title: "Best seller", hint: "ขายได้กี่ออเดอร์", Icon: Award },
  { key: "commission", title: "High commission", hint: "ค่าคอมที่เราได้", Icon: Coins },
  { key: "totalSales", title: "High seller", hint: "ยอดขายสินค้า", Icon: ShoppingCart },
];

function ProductTop({ products, rank }: { products: AffProduct[]; rank: (typeof RANKS)[number] }) {
  const list = topProducts(products, rank.key, 10);
  return (
    <article className="panel aff2-top">
      <div className="panel-head">
        <div>
          <h3>
            <rank.Icon size={15} /> Top 10 {rank.title}
          </h3>
          <p>เรียงตาม{rank.hint}</p>
        </div>
      </div>
      <ol>
        {list.map((p, i) => (
          <li key={p.productId}>
            <b className="aff2-rank">{i + 1}</b>
            <div>
              <span className="aff2-name" title={p.title}>
                {p.title || p.productId}
              </span>
              <small>
                <span className="tag">{p.category}</span> ค่าคอม {pct(p.totalSales ? p.commission / p.totalSales : 0)}
                {p.clicks ? ` · คลิก ${n0(p.clicks)}${p.orders ? ` · CVR ${pct(p.orders / p.clicks)}` : ""}` : ""}
              </small>
            </div>
            <div className="aff2-nums">
              <strong>{rank.key === "orders" ? `${n0(p.orders)} ออเดอร์` : rank.key === "commission" ? baht(p.commission) : baht(p.totalSales)}</strong>
              <small>
                {rank.key !== "commission" && `ค่าคอม ${baht(p.commission)}`}
                {rank.key === "commission" && `${n0(p.orders)} ออเดอร์`}
                {rank.key !== "totalSales" && ` · ขาย ${bahtShort(p.totalSales)}`}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function AffiliateDashboard({ data }: { data: AffiliateSheets & { readAt?: string } }) {
  const motion = useMotion();
  // From 2026 only (the team does not report 2025); the stored sheets keep every month as given.
  const monthly = data.monthly.filter((m) => m.month >= FIRST_MONTH);
  const dailyAll = data.daily.filter((d) => d.date >= `${FIRST_MONTH}-01`);
  const months = monthly.map((m) => m.month);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const [pick, setPick] = useState("ALL");
  const picked = pick === "ALL" ? [] : pick.length === 4 ? months.filter((m) => m.startsWith(pick)) : [pick];
  const t = monthTotals(monthly, picked);
  // Against the month before, when one month is picked.
  const prevMonth = pick.length === 7 ? months[months.indexOf(pick) - 1] : undefined;
  const prev = prevMonth ? monthTotals(monthly, [prevMonth]) : null;
  const change = (now: number, before?: number) => (before ? (now - before) / before : null);

  const chart = monthly.map((m) => ({ ...m, label: thMonth(m.month), on: !picked.length || picked.includes(m.month) }));
  const daily = useMemo(
    () => dailyAll.filter((d) => !picked.length || picked.includes(d.date.slice(0, 7))).map((d) => ({ ...d, label: thDay(d.date) })),
    [data.daily, pick], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Products and clips for the months picked: their monthly exports added up, or the long export.
  const lists = useMemo(() => listsFor(data, picked), [data, pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const products = lists.products;
  const contents = lists.contents;
  const clipValue = (c: (typeof contents)[number]) => c.earnedRevenue || c.estimatedRevenue;
  const monthsLabel = (ms: string[]) => (ms.length > 3 ? `${thMonth(ms[0])} – ${thMonth(ms[ms.length - 1])} (${ms.length} เดือน)` : ms.map(thMonth).join(", "));
  // Months whose product export is a clicks report only: no commission, sales or orders per product yet.
  const clicksOnly = lists.productMonths.filter((m) => !data.sources.some((s) => s.kind === "product" && s.month === m && (s.metrics || "revenue") === "revenue"));
  // The running month exported so far (e.g. 1–14 Oct).
  const partial = lists.productMonths
    .map((m) => ({ month: m, to: data.sources.filter((x) => x.kind === "product" && x.month === m).map((x) => x.to || "").sort().pop() || "" }))
    .filter((x) => x.to && x.to < new Date(Date.UTC(Number(x.month.slice(0, 4)), Number(x.month.slice(5, 7)), 0)).toISOString().slice(0, 10));
  const productSpan = lists.productMonths.length ? monthsLabel(lists.productMonths) : `${thDay(data.productRange.from)} – ${thDay(data.productRange.to)}`;
  const contentSpan = lists.contentMonths.length ? monthsLabel(lists.contentMonths) : `${thDay(data.contentRange.from)} – ${thDay(data.contentRange.to)}`;
  const categories = useMemo(() => {
    const m = new Map<string, { commission: number; sales: number; orders: number; items: number }>();
    for (const p of products) {
      const c = m.get(p.category) || { commission: 0, sales: 0, orders: 0, items: 0 };
      c.commission += p.commission;
      c.sales += p.totalSales;
      c.orders += p.orders;
      c.items++;
      m.set(p.category, c);
    }
    return [...m].map(([name, c]) => ({ name, ...c, rate: c.sales ? c.commission / c.sales : 0 })).sort((a, b) => b.commission - a.commission);
  }, [products]);
  const topContents = useMemo(() => [...contents].sort((a, b) => clipValue(b) - clipValue(a)).slice(0, 10), [contents]); // eslint-disable-line react-hooks/exhaustive-deps
  const programs = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contents) m.set(c.program, (m.get(c.program) || 0) + clipValue(c));
    return [...m].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v).slice(0, 6);
  }, [contents]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalCommission = contents.reduce((a, c) => a + c.totalCommission, 0);
  // The export gives removed commission as a negative amount.
  const removed = contents.reduce((a, c) => a + Math.abs(c.removedCommission), 0);
  const productCommission = products.reduce((a, p) => a + p.commission, 0);
  const dailyInProductRange = data.daily
    .filter((d) => (lists.productMonths.length ? lists.productMonths.includes(d.date.slice(0, 7)) : d.date >= data.productRange.from && d.date <= data.productRange.to))
    .reduce((a, d) => a + d.revenue, 0);
  const top10Share = productCommission ? topProducts(products, "commission", 10).reduce((a, p) => a + p.commission, 0) / productCommission : 0;

  const Delta = ({ v }: { v: number | null }) =>
    v === null ? null : (
      <em className={v >= 0 ? "aff2-up" : "aff2-down"}>
        {v >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {v >= 0 ? "+" : ""}
        {pct(v)} จาก {thMonth(prevMonth!)}
      </em>
    );

  return (
    <section className="aff2">
      <div className="aff2-head">
        <div>
          <span className="section-eyebrow">AFFILIATE DASHBOARD (THB)</span>
          <h2>YouTube Shopping Affiliate</h2>
          <p>
            จาก YouTube Studio 3 รายงาน (รายเดือน · รายคลิป · รายสินค้า) ใน Google Sheet{data.readAt ? ` · อ่านเมื่อ ${thDay(data.readAt.slice(0, 10))}` : ""}
          </p>
        </div>
        <label className="aff2-filter">
          เดือน
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="ALL">
              ทั้งหมด ({thMonth(months[0])} – {thMonth(months[months.length - 1])})
            </option>
            {years.length > 1 && years.map((y) => (
              <option key={y} value={y}>
                ปี {y}
              </option>
            ))}
            {[...months].reverse().map((m) => (
              <option key={m} value={m}>
                {thMonth(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="affiliate-kpis aff2-kpis">
        <article>
          <Coins style={{ color: "#059669" }} />
          <span>ค่าคอมที่ได้ (Earned)</span>
          <strong>{baht(t.earnedRevenue)}</strong>
          <small>
            {t.months} เดือน <Delta v={change(t.earnedRevenue, prev?.earnedRevenue)} />
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
          <span>% ค่าคอมเฉลี่ย</span>
          <strong>{pct(t.rate)}</strong>
          <small>ค่าคอม ÷ ยอดขาย</small>
        </article>
        <article>
          <Award style={{ color: "#db2777" }} />
          <span>ค่าคอมต่อออเดอร์</span>
          <strong>{baht(t.perOrder)}</strong>
          <small>ยอดขายต่อออเดอร์ {baht(t.orders ? t.totalSales / t.orders : 0)}</small>
        </article>
      </div>

      <div className="affiliate-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>ค่าคอมและออเดอร์รายเดือน</h3>
              <p>แท่ง = ค่าคอมที่ได้ · เส้น = ออเดอร์ · เดือนที่ไม่ได้เลือกเป็นสีจาง</p>
            </div>
          </div>
          <div className="affiliate-chart" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="b" tickFormatter={bahtShort} tick={{ fontSize: 10 }} width={52} />
                <YAxis yAxisId="o" orientation="right" tickFormatter={(v) => n0(v)} tick={{ fontSize: 10 }} width={44} />
                <Tooltip formatter={(v, name) => (name === "ออเดอร์" ? n0(Number(v)) : baht(Number(v)))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="b" dataKey="earnedRevenue" name="ค่าคอมที่ได้" radius={[4, 4, 0, 0]} isAnimationActive={motion}>
                  {chart.map((c) => (
                    <Cell key={c.month} fill="#059669" fillOpacity={c.on ? 1 : 0.25} />
                  ))}
                </Bar>
                <Line yAxisId="o" dataKey="orders" name="ออเดอร์" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={motion} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>รายได้รายวัน (Estimated)</h3>
              <p>
                {daily.length ? `${thDay(daily[0].date)} – ${thDay(daily[daily.length - 1].date)}` : "ไม่มีข้อมูลรายวันในช่วงนี้"} · จากแท็บ Totals (ค่าประมาณ ก่อนหักคืนสินค้า)
              </p>
            </div>
          </div>
          <div className="affiliate-chart" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tickFormatter={bahtShort} tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(v) => baht(Number(v))} />
                <Bar dataKey="revenue" name="รายได้ (Estimated)" fill="#10b981" radius={[2, 2, 0, 0]} isAnimationActive={motion} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <p className="aff2-note">
        Top สินค้าด้านล่างเป็นยอดของ <b>{productSpan}</b>
        {lists.productMonths.length ? " (จากไฟล์รายเดือน)" : " (ไฟล์รวม)"}
        {partial.map((x) => ` · ${thMonth(x.month)} ถึง ${thDay(x.to)} (ยังไม่จบเดือน)`).join("")}
        {clicksOnly.length > 0 && (
          <b className="aff2-warn"> · ไฟล์รายสินค้าของ {clicksOnly.map(thMonth).join(", ")} เป็นรายงานคลิก (Product clicks) ยังไม่มีค่าคอม/ยอดขาย/ออเดอร์ · export หน้า Product ใหม่โดยเลือกดู Estimated revenue</b>
        )}
        {pick !== "ALL" && lists.missing.length > 0 && ` · ยังไม่มีไฟล์รายเดือนของ ${lists.missing.map(thMonth).join(", ")} จึงแสดงยอดไฟล์รวมแทน`}
      </p>
      <div className="aff2-tops">
        {RANKS.map((r) => (
          <ProductTop key={r.key} products={products} rank={r} />
        ))}
      </div>

      <div className="affiliate-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>ค่าคอมตามหมวดสินค้า</h3>
              <p>
                {productSpan} · {n0(products.length)} สินค้า · ตัวเลขท้ายแถว = % ค่าคอมของหมวด
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>หมวด</th>
                  <th className="num">สินค้า</th>
                  <th className="num">ค่าคอม</th>
                  <th className="num">ยอดขาย</th>
                  <th className="num">ออเดอร์</th>
                  <th className="num">% ค่าคอม</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <span className="tag">{c.name}</span>
                    </td>
                    <td className="num">{n0(c.items)}</td>
                    <td className="num">
                      <b>{baht(c.commission)}</b>
                    </td>
                    <td className="num">{baht(c.sales)}</td>
                    <td className="num">{n0(c.orders)}</td>
                    <td className="num">{pct(c.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>
                <Video size={15} /> Top 10 คลิปที่ทำค่าคอม
              </h3>
              <p>
                {contentSpan} · เรียงตามค่าคอม{lists.contentMonths.length ? " (Estimated)" : " ที่ได้ (Earned)"}
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>คลิป</th>
                  <th className="num">ค่าคอม</th>
                  <th className="num">ออเดอร์</th>
                  <th className="num">ถูกตัด</th>
                </tr>
              </thead>
              <tbody>
                {topContents.map((c, i) => (
                  <tr key={c.contentId}>
                    <td>{i + 1}</td>
                    <td>
                      <a href={`https://www.youtube.com/watch?v=${c.contentId}`} target="_blank" rel="noreferrer" className="aff2-clip" title={c.title}>
                        {c.title || c.contentId}
                      </a>
                      <small className="aff2-sub">
                        {c.program} · {c.publishDate}
                      </small>
                    </td>
                    <td className="num">
                      <b>{baht(clipValue(c))}</b>
                    </td>
                    <td className="num">{c.orders ? n0(c.orders) : "–"}</td>
                    <td className="num">{c.removedCommission ? baht(Math.abs(c.removedCommission)) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="aff2-programs">
            {programs.map((p) => (
              <span key={p.name}>
                {p.name} <b>{bahtShort(p.v)}</b>
              </span>
            ))}
          </div>
        </article>
      </div>

      <div className="affiliate-quality">
        <strong>ข้อสังเกตจากข้อมูล</strong>
        <span>สินค้า 10 อันดับแรกทำค่าคอม {pct(top10Share)} ของ 500 สินค้า</span>
        {totalCommission > 0 && <span>ค่าคอมถูกตัด (คืนสินค้า/ยกเลิก) {pct(removed / totalCommission)} ของค่าคอมทั้งหมดในรายงานรายคลิป</span>}
        {dailyInProductRange > 0 && <span>500 สินค้าแรกครอบคลุม {pct(productCommission / dailyInProductRange)} ของรายได้ช่วงเดียวกัน</span>}
        <small>ค่าคอมรายเดือน = Earned revenue (ยอดที่ได้จริง) · รายสินค้าและรายวัน = Estimated revenue (ค่าประมาณ YouTube ไม่ให้ Earned รายสินค้า)</small>
      </div>
    </section>
  );
}
