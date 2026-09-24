"use client";
import { useEffect, useMemo, useState } from "react";
import { dashboardAsset, isStaticHost } from "@/lib/dashboard/hosting";
import { loadRevenueDataFromFirebase } from "@/lib/firebase";
import type { RevenueData, MonthlyRevenueItem } from "@/lib/dashboard/revenueParser";
import { RevenueImportModal } from "@/components/dashboard/sections/RevenueImportModal";
import type { User } from "@/lib/auth/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  Cloud,
  FileSpreadsheet,
  Layers,
  PlaySquare,
  Radio,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  Video,
  Wallet,
} from "lucide-react";

const money = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(v || 0);

const moneyCompact = (v: number) =>
  new Intl.NumberFormat("th-TH", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v || 0);

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface RevenueReportProps {
  currentUser?: User | null;
}

const COLORS = [
  "#2563eb", // Partner Ad Revenue (Blue)
  "#7c3aed", // YouTube Premium (Purple)
  "#059669", // Affiliate Program (Green)
  "#ea580c", // Shorts Feed Ads (Orange)
  "#db2777", // Shopping Bonus (Pink)
  "#0891b2", // Education Player (Cyan)
  "#eab308", // Super Chat & Stickers (Yellow)
];

export default function RevenueReport({ currentUser }: RevenueReportProps) {
  const [data, setData] = useState<RevenueData | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [importOpen, setImportOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"firebase" | "file">("firebase");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isStaticHost) {
        const cloudData = await loadRevenueDataFromFirebase();
        if (cloudData && cloudData.monthly.length > 0) {
          setData(cloudData);
          setSourceType("firebase");
          setLoading(false);
          return;
        }
      }

      // Fallback to static asset
      const res = await fetch(dashboardAsset("youtube-revenue.json"));
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

  const years = useMemo(() => {
    if (!data?.monthly) return [];
    const set = new Set(data.monthly.map((m) => String(m.year)));
    return Array.from(set).sort();
  }, [data]);

  const filteredMonthly = useMemo(() => {
    if (!data?.monthly) return [];
    if (selectedYear === "ALL") return data.monthly;
    return data.monthly.filter((m) => String(m.year) === selectedYear);
  }, [data, selectedYear]);

  // Aggregate totals
  const totals = useMemo(() => {
    return filteredMonthly.reduce(
      (acc, item) => ({
        estRevenue: acc.estRevenue + item.estRevenue,
        partnerAdRevenue: acc.partnerAdRevenue + item.partnerAdRevenue,
        youtubePremiumRevenue: acc.youtubePremiumRevenue + item.youtubePremiumRevenue,
        affiliateProgramRevenue: acc.affiliateProgramRevenue + item.affiliateProgramRevenue,
        shortsFeedAdsRevenue: acc.shortsFeedAdsRevenue + item.shortsFeedAdsRevenue,
        superChatAndStickers:
          acc.superChatAndStickers + item.superChatRevenue + item.superStickersRevenue,
        educationPlayerRevenue: acc.educationPlayerRevenue + item.educationPlayerRevenue,
        shoppingAffiliateBonus: acc.shoppingAffiliateBonus + item.shoppingAffiliateBonus,
      }),
      {
        estRevenue: 0,
        partnerAdRevenue: 0,
        youtubePremiumRevenue: 0,
        affiliateProgramRevenue: 0,
        shortsFeedAdsRevenue: 0,
        superChatAndStickers: 0,
        educationPlayerRevenue: 0,
        shoppingAffiliateBonus: 0,
      }
    );
  }, [filteredMonthly]);

  // Distribution for Pie Chart
  const distributionData = useMemo(() => {
    const list = [
      { name: "Partner Ad Revenue", value: totals.partnerAdRevenue, color: "#2563eb" },
      { name: "YouTube Premium", value: totals.youtubePremiumRevenue, color: "#7c3aed" },
      { name: "Affiliate Program", value: totals.affiliateProgramRevenue, color: "#059669" },
      { name: "Shorts Feed Ads", value: totals.shortsFeedAdsRevenue, color: "#ea580c" },
      { name: "Shopping Bonus", value: totals.shoppingAffiliateBonus, color: "#db2777" },
      { name: "Super Chat & Stickers", value: totals.superChatAndStickers, color: "#eab308" },
      { name: "Education Player", value: totals.educationPlayerRevenue, color: "#0891b2" },
    ].filter((x) => x.value > 0);

    return list;
  }, [totals]);

  const isAdmin = currentUser?.role === "admin";

  return (
    <section className="affiliate-report" id="revenue" style={{ marginTop: 24 }}>
      {/* Header */}
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
                background: sourceType === "firebase" ? "#eff6ff" : "#f1f5f9",
                color: sourceType === "firebase" ? "#2563eb" : "#64748b",
                fontWeight: 600,
                border: `1px solid ${sourceType === "firebase" ? "#bfdbfe" : "#e2e8f0"}`,
              }}
            >
              {sourceType === "firebase" ? <Cloud size={12} /> : <FileSpreadsheet size={12} />}
              {sourceType === "firebase" ? "Firebase Firestore" : "Local Asset"}
            </span>
          </div>
          <h2>YouTube Revenue Breakdown</h2>
          <p>
            วิเคราะห์โครงสร้างรายได้ YouTube แยกตามประเภทรายได้: โฆษณาหลัก (Partner Ads), Shorts, Premium, Affiliate และ Super features
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
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              transition: "opacity 0.2s",
            }}
          >
            <Upload size={15} />
            Import Revenue Report
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

          {years.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              ปี{" "}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  background: "#fff",
                  fontWeight: 600,
                }}
              >
                <option value="ALL">ทั้งหมด ({years.join(", ")})</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    ปี {y}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {!data || filteredMonthly.length === 0 ? (
        <div
          className="empty-state"
          style={{ padding: "48px 0", background: "#f8fafc", borderRadius: 12, textAlign: "center" }}
        >
          <BadgeDollarSign size={36} color="#94a3b8" />
          <span style={{ color: "#64748b", fontWeight: 600, display: "block", marginTop: 8 }}>
            {loading ? "กำลังโหลดข้อมูล Revenue จากระบบ..." : "ยังไม่มีข้อมูล YouTube Revenue ในระบบ"}
          </span>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            นำเข้าไฟล์รายงาน YouTube Revenue ตอนนี้
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="affiliate-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <article>
              <Wallet style={{ color: "#2563eb" }} />
              <span>EST. Total Revenue</span>
              <strong>{money(totals.estRevenue)}</strong>
              <small>{filteredMonthly.length} เดือนที่บันทึก</small>
            </article>
            <article>
              <PlaySquare style={{ color: "#0284c7" }} />
              <span>Partner Ad Revenue</span>
              <strong>{money(totals.partnerAdRevenue)}</strong>
              <small>{pct(totals.partnerAdRevenue / (totals.estRevenue || 1))} ของรายได้รวม</small>
            </article>
            <article>
              <Video style={{ color: "#7c3aed" }} />
              <span>YouTube Premium</span>
              <strong>{money(totals.youtubePremiumRevenue)}</strong>
              <small>{pct(totals.youtubePremiumRevenue / (totals.estRevenue || 1))} ของรายได้รวม</small>
            </article>
            <article>
              <ShoppingBag style={{ color: "#059669" }} />
              <span>Affiliate & Bonus</span>
              <strong>{money(totals.affiliateProgramRevenue + totals.shoppingAffiliateBonus)}</strong>
              <small>Affiliate: {money(totals.affiliateProgramRevenue)}</small>
            </article>
            <article>
              <Sparkles style={{ color: "#ea580c" }} />
              <span>Shorts Feed Ads</span>
              <strong>{money(totals.shortsFeedAdsRevenue)}</strong>
              <small>{pct(totals.shortsFeedAdsRevenue / (totals.estRevenue || 1))} ของรายได้รวม</small>
            </article>
          </div>

          {/* Charts Grid */}
          <div className="affiliate-grid">
            {/* Monthly Trend Stacked Bar Chart */}
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h3>แนวโน้มรายได้รายเดือน (Monthly Revenue Streams)</h3>
                  <p>แยกสัดส่วน Partner Ads, Premium, Affiliate และ Shorts Ads</p>
                </div>
              </div>
              <div className="affiliate-chart" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e8edf5" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="partnerAdRevenue" name="Partner Ads" stackId="a" fill="#2563eb" />
                    <Bar dataKey="youtubePremiumRevenue" name="Premium" stackId="a" fill="#7c3aed" />
                    <Bar dataKey="affiliateProgramRevenue" name="Affiliate" stackId="a" fill="#059669" />
                    <Bar dataKey="shortsFeedAdsRevenue" name="Shorts Feed" stackId="a" fill="#ea580c" />
                    <Bar dataKey="shoppingAffiliateBonus" name="Shopping Bonus" stackId="a" fill="#db2777" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Revenue Distribution Pie Chart */}
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h3>สัดส่วนโครงสร้างรายได้ (Revenue Breakdown)</h3>
                  <p>สัดส่วนเปอร์เซ็นต์ตามประเภทรายได้ทั้งหมด</p>
                </div>
              </div>
              <div className="affiliate-chart" style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={45}
                      paddingAngle={2}
                      label={({ percent }: { percent?: number }) =>
                        typeof percent === "number" ? `${(percent * 100).toFixed(1)}%` : ""
                      }
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          {/* Detailed Monthly Breakdown Table */}
          <div className="affiliate-tables" style={{ gridTemplateColumns: "1fr" }}>
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h3>ตารางสรุปรายได้รายเดือนทั้งหมด (Monthly Revenue Table)</h3>
                  <p>แสดงทุกคอลัมน์และประเภทรายได้ตามรายงาน YouTube Analytics</p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>เดือน</th>
                      <th style={{ textAlign: "right" }}>EST. Revenue</th>
                      <th style={{ textAlign: "right" }}>Partner Ad Revenue</th>
                      <th style={{ textAlign: "right" }}>YouTube Premium</th>
                      <th style={{ textAlign: "right" }}>Affiliate Program</th>
                      <th style={{ textAlign: "right" }}>Shorts Feed Ads</th>
                      <th style={{ textAlign: "right" }}>Shopping Bonus</th>
                      <th style={{ textAlign: "right" }}>Super Chat</th>
                      <th style={{ textAlign: "right" }}>Super Stickers</th>
                      <th style={{ textAlign: "right" }}>Education Player</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonthly.map((row) => (
                      <tr key={row.month}>
                        <td>
                          <strong>{row.monthLabel}</strong>
                        </td>
                        <td style={{ textAlign: "right", color: "#1e40af", fontWeight: 700 }}>
                          {money(row.estRevenue)}
                        </td>
                        <td style={{ textAlign: "right" }}>{money(row.partnerAdRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.youtubePremiumRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.affiliateProgramRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.shortsFeedAdsRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.shoppingAffiliateBonus)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.superChatRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.superStickersRevenue)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.educationPlayerRevenue)}</td>
                      </tr>
                    ))}
                    {/* Summary Row */}
                    <tr style={{ background: "#f8fafc", fontWeight: "bold", borderTop: "2px solid #cbd5e1" }}>
                      <td>รวมทั้งหมด</td>
                      <td style={{ textAlign: "right", color: "#1e40af", fontSize: 14 }}>
                        {money(totals.estRevenue)}
                      </td>
                      <td style={{ textAlign: "right" }}>{money(totals.partnerAdRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.youtubePremiumRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.affiliateProgramRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.shortsFeedAdsRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.shoppingAffiliateBonus)}</td>
                      <td style={{ textAlign: "right" }}>
                        {money(filteredMonthly.reduce((a, b) => a + b.superChatRevenue, 0))}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {money(filteredMonthly.reduce((a, b) => a + b.superStickersRevenue, 0))}
                      </td>
                      <td style={{ textAlign: "right" }}>{money(totals.educationPlayerRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </>
      )}

      <RevenueImportModal
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
