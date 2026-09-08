"use client";
import { dashboardAsset } from "@/lib/dashboard/hosting";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

type Summary = {
  year: number;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
  commissionRate: number;
  avgOrderValue: number;
  contentRows: number;
  productRows: number;
  contentRevenueCoverage: number;
  productRevenueCoverage: number;
};
type Content = {
  year: number;
  contentId: string;
  videoTitle: string;
  publishDate: string;
  program: string;
  videoType: string;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
  url: string;
};
type Product = {
  year: number;
  productId: string;
  productTitle: string;
  category: string;
  affiliateRevenue: number;
  totalSales: number;
  orders: number;
};
type Daily = { date: string; year: number; affiliateRevenue: number };
type AffiliateData = {
  generatedAt: string;
  summary: Summary[];
  contents: Content[];
  products: Product[];
  daily: Daily[];
};
const money = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(v || 0);
const num = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v || 0);
const compact = (v: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v || 0);
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function AffiliateReport() {
  const [data, setData] = useState<AffiliateData | null>(null),
    [year, setYear] = useState("ALL");
  useEffect(() => {
    fetch(dashboardAsset("affiliate-data.json"))
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);
  const selected = useMemo(
    () =>
      data?.summary.filter((x) => year === "ALL" || x.year === Number(year)) ||
      [],
    [data, year],
  );
  const kpi = useMemo(
    () =>
      selected.reduce(
        (a, x) => ({
          affiliateRevenue: a.affiliateRevenue + x.affiliateRevenue,
          totalSales: a.totalSales + x.totalSales,
          orders: a.orders + x.orders,
        }),
        { affiliateRevenue: 0, totalSales: 0, orders: 0 },
      ),
    [selected],
  );
  const commission = kpi.totalSales ? kpi.affiliateRevenue / kpi.totalSales : 0,
    aov = kpi.orders ? kpi.totalSales / kpi.orders : 0;
  const daily = useMemo(() => {
    const m = new Map<string, number>();
    (data?.daily || [])
      .filter((x) => year === "ALL" || x.year === Number(year))
      .forEach((x) => {
        const key = x.date.slice(0, 7);
        m.set(key, (m.get(key) || 0) + x.affiliateRevenue);
      });
    return [...m]
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data, year]);
  const contents = useMemo(
    () =>
      data?.contents.filter((x) => year === "ALL" || x.year === Number(year)) ||
      [],
    [data, year],
  );
  const products = useMemo(
    () =>
      data?.products.filter((x) => year === "ALL" || x.year === Number(year)) ||
      [],
    [data, year],
  );
  const programs = useMemo(() => {
    const m = new Map<string, number>();
    contents.forEach((x) =>
      m.set(x.program, (m.get(x.program) || 0) + x.affiliateRevenue),
    );
    return [...m]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [contents]);
  if (!data)
    return (
      <section className="panel affiliate-report" id="affiliate">
        <div className="empty-state">
          <BadgeDollarSign />
          <span>ไม่สามารถโหลดข้อมูล Affiliate ได้</span>
        </div>
      </section>
    );
  return (
    <section className="affiliate-report" id="affiliate">
      <div className="affiliate-head">
        <div>
          <span className="section-eyebrow">REVENUE REPORT</span>
          <h2>Affiliate Program Performance</h2>
          <p>
            ยอดรวมอ้างอิงจาก Total ของไฟล์ต้นฉบับ · ตาราง Content/Product เป็น
            Top 500 ต่อปี
          </p>
        </div>
        <label>
          ปี{" "}
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="ALL">ทั้งหมด</option>
            {data.summary.map((x) => (
              <option key={x.year}>{x.year}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="affiliate-kpis">
        <article>
          <BadgeDollarSign />
          <span>Affiliate Revenue</span>
          <strong>{money(kpi.affiliateRevenue)}</strong>
        </article>
        <article>
          <TrendingUp />
          <span>Total Sales</span>
          <strong>{money(kpi.totalSales)}</strong>
        </article>
        <article>
          <ShoppingCart />
          <span>Orders</span>
          <strong>{num(kpi.orders)}</strong>
        </article>
        <article>
          <ShoppingBag />
          <span>Commission Rate</span>
          <strong>{pct(commission)}</strong>
          <small>AOV {money(aov)}</small>
        </article>
      </div>
      <div className="affiliate-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Affiliate Revenue รายเดือน</h3>
              <p>ใช้ยอด Daily Totals จากต้นฉบับ</p>
            </div>
          </div>
          <div className="affiliate-chart">
            <ResponsiveContainer>
              <LineChart data={daily}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Line
                  dataKey="revenue"
                  name="Affiliate Revenue"
                  type="monotone"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>รายได้ตาม Program</h3>
              <p>คำนวณจาก Top 500 Content ที่ระบุชื่อรายการได้</p>
            </div>
          </div>
          <div className="affiliate-chart">
            <ResponsiveContainer>
              <BarChart data={programs} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="#e8edf5" />
                <XAxis
                  type="number"
                  tickFormatter={compact}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={105}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar
                  dataKey="revenue"
                  name="Affiliate Revenue"
                  fill="#176bce"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
      <div className="affiliate-tables">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Top Content by Affiliate Revenue</h3>
              <p>วันที่ลง · Program · VDO Type · Revenue</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Content</th>
                  <th>วันที่ลง</th>
                  <th>Program</th>
                  <th>VDO Type</th>
                  <th>Revenue</th>
                  <th>Sales</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {contents.slice(0, 10).map((x, i) => (
                  <tr key={`${x.year}-${x.contentId}`}>
                    <td>{i + 1}</td>
                    <td>
                      <a href={x.url} target="_blank" rel="noreferrer">
                        {x.videoTitle}
                      </a>
                    </td>
                    <td>{x.publishDate}</td>
                    <td>{x.program}</td>
                    <td>
                      <span className="tag">{x.videoType}</span>
                    </td>
                    <td>
                      <b>{money(x.affiliateRevenue)}</b>
                    </td>
                    <td>{money(x.totalSales)}</td>
                    <td>{num(x.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Top Product by Affiliate Revenue</h3>
              <p>Top 500 จาก Source Export เท่านั้น</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>สินค้า</th>
                  <th>Category</th>
                  <th>Revenue</th>
                  <th>Sales</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map((x, i) => (
                  <tr key={`${x.year}-${x.productId}`}>
                    <td>{i + 1}</td>
                    <td>{x.productTitle}</td>
                    <td>
                      <span className="tag">{x.category}</span>
                    </td>
                    <td>
                      <b>{money(x.affiliateRevenue)}</b>
                    </td>
                    <td>{money(x.totalSales)}</td>
                    <td>{num(x.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
      <div className="affiliate-quality">
        <strong>Data Coverage</strong>
        {selected.map((x) => (
          <span key={x.year}>
            {x.year}: Content {pct(x.contentRevenueCoverage)} · Product{" "}
            {pct(x.productRevenueCoverage)}
          </span>
        ))}
        <small>
          Product export ครอบคลุมรายได้เพียงบางส่วน จึงไม่ใช้ผลรวม Product list
          แทนยอด Total
        </small>
      </div>
    </section>
  );
}
