"use client";
import { dashboardAsset, isStaticHost } from "@/lib/dashboard/hosting";
import { loadAffiliateDataFromFirebase } from "@/lib/firebase";
import type { AffiliateData } from "@/lib/dashboard/affiliateParser";
import { AffiliateImportModal } from "@/components/dashboard/sections/AffiliateImportModal";
import type { User } from "@/lib/auth/types";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  Cloud,
  FileSpreadsheet,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Upload,
} from "lucide-react";

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

interface AffiliateReportProps {
  currentUser?: User | null;
}

export default function AffiliateReport({ currentUser }: AffiliateReportProps) {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [year, setYear] = useState("ALL");
  const [importOpen, setImportOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"firebase" | "file">("firebase");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isStaticHost) {
        const cloudData = await loadAffiliateDataFromFirebase();
        if (cloudData && cloudData.summary.length > 0) {
          setData(cloudData);
          setSourceType("firebase");
          setLoading(false);
          return;
        }
      }

      // Fallback to static asset if no Firebase data or on static host
      const res = await fetch(dashboardAsset("affiliate-data.json"));
      if (res.ok) {
        const fileData = await res.json();
        setData(fileData);
        setSourceType("file");
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const commission = kpi.totalSales ? kpi.affiliateRevenue / kpi.totalSales : 0;
  const aov = kpi.orders ? kpi.totalSales / kpi.orders : 0;

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

  const isAdmin = currentUser?.role === "admin";

  return (
    <section className="affiliate-report" id="affiliate">
      <div className="affiliate-head" style={{ alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="section-eyebrow">REVENUE REPORT</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: sourceType === "firebase" ? "#ecfdf5" : "#f1f5f9",
                color: sourceType === "firebase" ? "#059669" : "#64748b",
                fontWeight: 600,
                border: `1px solid ${sourceType === "firebase" ? "#a7f3d0" : "#e2e8f0"}`,
              }}
            >
              {sourceType === "firebase" ? <Cloud size={12} /> : <FileSpreadsheet size={12} />}
              {sourceType === "firebase" ? "Firebase Firestore" : "Local Asset"}
            </span>
          </div>
          <h2>Affiliate Program Performance</h2>
          <p>
            ยอดรวมอ้างอิงจาก Total ของไฟล์ต้นฉบับ · ตาราง Content/Product เป็น
            Top 500 ต่อปี
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.25)",
              transition: "opacity 0.2s",
            }}
          >
            <Upload size={15} />
            Import Affiliate Report
          </button>

          <button
            onClick={loadData}
            title="รีเฟรชข้อมูลจาก Firebase"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          {data && (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              ปี{" "}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  background: "#fff",
                  fontWeight: 600,
                }}
              >
                <option value="ALL">ทั้งหมด</option>
                {data.summary.map((x) => (
                  <option key={x.year} value={x.year}>
                    {x.year}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {!data ? (
        <div
          className="empty-state"
          style={{ padding: "48px 0", background: "#f8fafc", borderRadius: 12 }}
        >
          <BadgeDollarSign size={36} color="#94a3b8" />
          <span style={{ color: "#64748b", fontWeight: 600 }}>
            {loading ? "กำลังโหลดข้อมูล Affiliate จาก Firebase..." : "ยังไม่มีข้อมูล Affiliate ในระบบ"}
          </span>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              marginTop: 10,
              padding: "8px 16px",
              borderRadius: 8,
              background: "#059669",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            นำเข้าไฟล์รายงาน Affiliate ตอนนี้
          </button>
        </div>
      ) : (
        <>
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
        </>
      )}

      <AffiliateImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        currentData={data}
        onDataUpdated={(newData) => {
          setData(newData);
          setSourceType("firebase");
        }}
        isAdmin={isAdmin}
      />
    </section>
  );
}
