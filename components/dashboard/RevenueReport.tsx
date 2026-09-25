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
  Calculator,
  Calendar,
  Cloud,
  Coins,
  FileSpreadsheet,
  Gift,
  HeartHandshake,
  Layers,
  PlaySquare,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  Video,
  Wallet,
} from "lucide-react";

// Format currency as USD
const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v || 0);

const moneyCompact = (v: number) =>
  new Intl.NumberFormat("en-US", {
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
  "#db2777", // Shopping Star Bonus (Pink)
  "#0891b2", // Shopping Affiliate Bonus (Cyan)
  "#eab308", // Memberships & Fan Funding (Yellow)
  "#6366f1", // Education Player (Indigo)
];

const MONTH_ORDER = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
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

  const allMonthly = useMemo(() => {
    return [...(data?.monthly || [])].sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  const years = useMemo(() => {
    if (allMonthly.length === 0) return [];
    const set = new Set(allMonthly.map((m) => String(m.year)));
    return Array.from(set).sort();
  }, [allMonthly]);

  const filteredMonthly = useMemo(() => {
    if (selectedYear === "ALL") return allMonthly;
    return allMonthly.filter((m) => String(m.year) === selectedYear);
  }, [allMonthly, selectedYear]);

  // Aggregate totals across all 13 fields
  const totals = useMemo(() => {
    return filteredMonthly.reduce(
      (acc, item) => ({
        estRevenue: acc.estRevenue + item.estRevenue,
        partnerAdRevenue: acc.partnerAdRevenue + item.partnerAdRevenue,
        youtubePremiumRevenue: acc.youtubePremiumRevenue + item.youtubePremiumRevenue,
        affiliateProgramRevenue: acc.affiliateProgramRevenue + item.affiliateProgramRevenue,
        shortsFeedAdsRevenue: acc.shortsFeedAdsRevenue + item.shortsFeedAdsRevenue,
        membershipsRevenue: acc.membershipsRevenue + (item.membershipsRevenue || 0),
        superChatRevenue: acc.superChatRevenue + (item.superChatRevenue || 0),
        superThanksRevenue: acc.superThanksRevenue + (item.superThanksRevenue || 0),
        giftedMembershipsRevenue: acc.giftedMembershipsRevenue + (item.giftedMembershipsRevenue || 0),
        superStickersRevenue: acc.superStickersRevenue + (item.superStickersRevenue || 0),
        educationPlayerRevenue: acc.educationPlayerRevenue + (item.educationPlayerRevenue || 0),
        shoppingStarBonus: acc.shoppingStarBonus + (item.shoppingStarBonus || 0),
        shoppingAffiliateBonus: acc.shoppingAffiliateBonus + (item.shoppingAffiliateBonus || 0),
      }),
      {
        estRevenue: 0,
        partnerAdRevenue: 0,
        youtubePremiumRevenue: 0,
        affiliateProgramRevenue: 0,
        shortsFeedAdsRevenue: 0,
        membershipsRevenue: 0,
        superChatRevenue: 0,
        superThanksRevenue: 0,
        giftedMembershipsRevenue: 0,
        superStickersRevenue: 0,
        educationPlayerRevenue: 0,
        shoppingStarBonus: 0,
        shoppingAffiliateBonus: 0,
      }
    );
  }, [filteredMonthly]);

  // Fan funding totals (Memberships, Gifted, Super Chat, Thanks, Stickers)
  const fanFundingTotal = useMemo(() => {
    return (
      totals.membershipsRevenue +
      totals.superChatRevenue +
      totals.superThanksRevenue +
      totals.giftedMembershipsRevenue +
      totals.superStickersRevenue
    );
  }, [totals]);

  // Shopping Total (Star Bonus + Affiliate Bonus)
  const totalShoppingBonus = useMemo(() => {
    return totals.shoppingStarBonus + totals.shoppingAffiliateBonus;
  }, [totals]);

  // Forecast & Accuracy Calculations
  const forecast = useMemo(() => {
    if (allMonthly.length === 0) return null;

    // Latest recorded month data
    const latestItem = allMonthly[allMonthly.length - 1];
    const latestMonthKey = latestItem.month; // e.g. "2026-09"
    const [currYearStr, currMonthStr] = latestMonthKey.split("-");
    const currYear = parseInt(currYearStr, 10);
    const currMonthNum = parseInt(currMonthStr, 10);

    // Filter all recorded months for the latest active year
    const yearRecords = allMonthly.filter((m) => m.year === currYear);
    const recordedMonthsCount = yearRecords.length;
    const yearActualTotal = yearRecords.reduce((acc, m) => acc + m.estRevenue, 0);

    // Recent 3-month trailing average for momentum
    const recent3 = allMonthly.slice(-3);
    const recent3Avg = recent3.reduce((acc, m) => acc + m.estRevenue, 0) / recent3.length;

    // Recent 6-month trailing average
    const recent6 = allMonthly.slice(-6);
    const recent6Avg = recent6.reduce((acc, m) => acc + m.estRevenue, 0) / recent6.length;

    // Year-to-date average per recorded month
    const ytdMonthlyAvg = recordedMonthsCount > 0 ? yearActualTotal / recordedMonthsCount : recent3Avg;

    // Weighted projection base: 50% 3-month momentum + 30% YTD avg + 20% 6-month baseline
    const projectedPerRemainingMonth = recent3Avg * 0.5 + ytdMonthlyAvg * 0.3 + recent6Avg * 0.2;

    // 1. Current Latest Month Finalized Revenue
    const latestMonthRevenue = latestItem.estRevenue;

    // 2. Next Month Forecast (e.g. Oct 2026 if latest is Sep 2026)
    const nextMonthNum = currMonthNum === 12 ? 1 : currMonthNum + 1;
    const nextMonthYear = currMonthNum === 12 ? currYear + 1 : currYear;
    const nextMonthLabel = `${MONTH_ORDER[nextMonthNum - 1]} ${nextMonthYear}`;
    const nextMonthForecast = projectedPerRemainingMonth;

    // 3. Full Year Projected Total for the latest active year
    const remainingMonthsThisYear = Math.max(0, 12 - currMonthNum);
    const projectedRemainingRevenue = remainingMonthsThisYear * projectedPerRemainingMonth;
    const fullYearProjectedTotal = yearActualTotal + projectedRemainingRevenue;

    // Accuracy / Run Rate metrics
    const annualRunRate = ytdMonthlyAvg * 12;

    return {
      latestMonthLabel: latestItem.monthLabel,
      latestMonthRevenue,
      nextMonthLabel,
      nextMonthForecast,
      currYear,
      recordedMonthsCount: currMonthNum,
      remainingMonthsThisYear,
      yearActualTotal,
      projectedRemainingRevenue,
      fullYearProjectedTotal,
      annualRunRate,
      recent3Avg,
    };
  }, [allMonthly]);

  // Distribution for Pie Chart
  const distributionData = useMemo(() => {
    const list = [
      { name: "Partner Ad Revenue", value: totals.partnerAdRevenue, color: "#2563eb" },
      { name: "YouTube Premium", value: totals.youtubePremiumRevenue, color: "#7c3aed" },
      { name: "Shopping Star Bonus", value: totals.shoppingStarBonus, color: "#db2777" },
      { name: "Affiliate Program", value: totals.affiliateProgramRevenue, color: "#059669" },
      { name: "Shorts Feed Ads", value: totals.shortsFeedAdsRevenue, color: "#ea580c" },
      { name: "Shopping Affiliate Bonus", value: totals.shoppingAffiliateBonus, color: "#0891b2" },
      { name: "Memberships & Super Features", value: fanFundingTotal, color: "#eab308" },
      { name: "Education Player", value: totals.educationPlayerRevenue, color: "#6366f1" },
    ].filter((x) => x.value > 0);

    return list;
  }, [totals, fanFundingTotal]);

  // Forecast trend chart data combining actuals + next month forecast
  const trendWithForecast = useMemo(() => {
    const list = filteredMonthly.map((m) => ({
      monthLabel: m.monthLabel,
      actualRevenue: m.estRevenue,
      forecastRevenue: undefined as number | undefined,
      partnerAdRevenue: m.partnerAdRevenue,
      youtubePremiumRevenue: m.youtubePremiumRevenue,
      shoppingStarBonus: m.shoppingStarBonus || 0,
      affiliateProgramRevenue: m.affiliateProgramRevenue || 0,
    }));

    if (forecast && (selectedYear === "ALL" || selectedYear === String(forecast.currYear))) {
      list.push({
        monthLabel: `${forecast.nextMonthLabel} (Est)`,
        actualRevenue: undefined as unknown as number,
        forecastRevenue: forecast.nextMonthForecast,
        partnerAdRevenue: forecast.nextMonthForecast * 0.70,
        youtubePremiumRevenue: forecast.nextMonthForecast * 0.22,
        shoppingStarBonus: 0,
        affiliateProgramRevenue: forecast.nextMonthForecast * 0.05,
      });
    }

    return list;
  }, [filteredMonthly, forecast, selectedYear]);

  const isAdmin = currentUser?.role === "admin";

  return (
    <section className="affiliate-report" id="revenue" style={{ marginTop: 24 }}>
      {/* Header */}
      <div className="affiliate-head" style={{ alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="section-eyebrow">REVENUE REPORT (USD)</span>
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
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#fef3c7",
                color: "#92400e",
                fontWeight: 700,
                border: "1px solid #fde68a",
              }}
            >
              <Coins size={12} />
              Currency: USD ($)
            </span>
          </div>
          <h2>YouTube Revenue & Forecast Analysis</h2>
          <p>
            วิเคราะห์โครงสร้างรายได้ YouTube ครบทุก 13 ประเภทรายได้ (หน่วย USD) พร้อมระบบคาดการณ์รายได้ (Revenue Forecasting & Accuracy Projection)
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
            Import Revenue (USD)
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
            นำเข้าไฟล์รายงาน YouTube Revenue (USD) ตอนนี้
          </button>
        </div>
      ) : (
        <>
          {/* Revenue Forecasting & Accurate Projection Cards */}
          {forecast && (
            <div
              style={{
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                borderRadius: 16,
                padding: "20px 24px",
                color: "#fff",
                display: "grid",
                gap: 16,
                boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      background: "rgba(59, 130, 246, 0.2)",
                      padding: 8,
                      borderRadius: 10,
                      color: "#60a5fa",
                      display: "flex",
                    }}
                  >
                    <Calculator size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f8fafc" }}>
                      Accurate Revenue Forecast & Year-End Projections ({forecast.currYear})
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                      โมเดลคาดการณ์น้ำหนักผสม (3M Momentum + YTD Average + Trailing Run Rate)
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    background: "rgba(255, 255, 255, 0.08)",
                    padding: "4px 12px",
                    borderRadius: 999,
                    color: "#cbd5e1",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  บันทึกแล้ว {forecast.recordedMonthsCount}/12 เดือน (เหลืออีก {forecast.remainingMonthsThisYear} เดือน)
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                {/* Metric 1: Latest Actual Month */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
                    <Calendar size={14} />
                    <span>ยอดจริงเดือนล่าสุด ({forecast.latestMonthLabel})</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>
                    {money(forecast.latestMonthRevenue)}
                  </div>
                  <small style={{ color: "#64748b", fontSize: 11 }}>ปิดยอดสมบูรณ์ตามรายงานจริง</small>
                </div>

                {/* Metric 2: Next Month Forecast */}
                <div
                  style={{
                    background: "rgba(59, 130, 246, 0.1)",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(96, 165, 250, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#93c5fd", fontSize: 12 }}>
                    <Sparkles size={14} />
                    <span>คาดการณ์เดือนถัดไป ({forecast.nextMonthLabel})</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#60a5fa", marginTop: 4 }}>
                    {money(forecast.nextMonthForecast)}
                  </div>
                  <small style={{ color: "#93c5fd", fontSize: 11 }}>
                    คาดการณ์ตามโมเมนตัม 3 เดือนเฉลี่ย ({moneyCompact(forecast.recent3Avg)}/mo)
                  </small>
                </div>

                {/* Metric 3: Full Year Forecast Total */}
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(52, 211, 153, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6ee7b7", fontSize: 12 }}>
                    <Target size={14} />
                    <span>คาดการณ์ยอดรวมทั้งปี {forecast.currYear} (Full Year Projected)</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#34d399", marginTop: 4 }}>
                    {money(forecast.fullYearProjectedTotal)}
                  </div>
                  <small style={{ color: "#a7f3d0", fontSize: 11 }}>
                    สะสมจริง {moneyCompact(forecast.yearActualTotal)} + คาดการณ์อีก {forecast.remainingMonthsThisYear} เดือน {moneyCompact(forecast.projectedRemainingRevenue)}
                  </small>
                </div>

                {/* Metric 4: Annual Run Rate */}
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
                    <TrendingUp size={14} />
                    <span>YTD Run-rate (อัตราเฉลี่ยรายปี)</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#facc15", marginTop: 4 }}>
                    {money(forecast.annualRunRate)}
                  </div>
                  <small style={{ color: "#64748b", fontSize: 11 }}>
                    อัตราเฉลี่ย {moneyCompact(forecast.yearActualTotal / forecast.recordedMonthsCount)}/เดือน
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards in USD */}
          <div className="affiliate-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <article>
              <Wallet style={{ color: "#2563eb" }} />
              <span>EST. Total Revenue</span>
              <strong>{money(totals.estRevenue)}</strong>
              <small>{filteredMonthly.length} เดือนที่บันทึก (USD)</small>
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
              <Star style={{ color: "#db2777" }} />
              <span>Shopping Star & Bonus</span>
              <strong>{money(totalShoppingBonus)}</strong>
              <small>Star: {money(totals.shoppingStarBonus)} · Aff: {money(totals.shoppingAffiliateBonus)}</small>
            </article>
            <article>
              <ShoppingBag style={{ color: "#059669" }} />
              <span>Affiliate Program</span>
              <strong>{money(totals.affiliateProgramRevenue)}</strong>
              <small>{pct(totals.affiliateProgramRevenue / (totals.estRevenue || 1))} ของรายได้รวม</small>
            </article>
            <article>
              <Sparkles style={{ color: "#ea580c" }} />
              <span>Shorts Feed Ads</span>
              <strong>{money(totals.shortsFeedAdsRevenue)}</strong>
              <small>{pct(totals.shortsFeedAdsRevenue / (totals.estRevenue || 1))} ของรายได้รวม</small>
            </article>
            <article>
              <HeartHandshake style={{ color: "#eab308" }} />
              <span>Memberships & Supers</span>
              <strong>{money(fanFundingTotal)}</strong>
              <small>Chat, Thanks, Stickers, Members</small>
            </article>
          </div>

          {/* Charts Grid */}
          <div className="affiliate-grid">
            {/* Monthly Trend & Forecast Chart */}
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h3>แนวโน้มรายได้และคาดการณ์รายเดือน (Revenue & Forecast Trend - USD)</h3>
                  <p>แสดงยอดจริงย้อนหลังพร้อมแท่งคาดการณ์อนาคต (Estimate)</p>
                </div>
              </div>
              <div className="affiliate-chart" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendWithForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e8edf5" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={moneyCompact} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="actualRevenue" name="Actual Revenue (USD)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="forecastRevenue" name="Forecast (Est. USD)" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Revenue Distribution Pie Chart */}
            <article className="panel">
              <div className="panel-head">
                <div>
                  <h3>สัดส่วนโครงสร้างรายได้ (Revenue Breakdown - USD)</h3>
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
                  <h3>ตารางสรุปรายได้รายเดือนทั้งหมด (Monthly Revenue Table - USD)</h3>
                  <p>แสดงทุกคอลัมน์และประเภทรายได้ 13 ฟิลด์ตามรายงาน YouTube Analytics (หน่วยเป็น USD)</p>
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
                      <th style={{ textAlign: "right" }}>Affiliate program</th>
                      <th style={{ textAlign: "right" }}>Shorts Feed ads</th>
                      <th style={{ textAlign: "right" }}>Memberships</th>
                      <th style={{ textAlign: "right" }}>Super Chat</th>
                      <th style={{ textAlign: "right" }}>Super Thanks</th>
                      <th style={{ textAlign: "right" }}>Gifted memberships</th>
                      <th style={{ textAlign: "right" }}>Super Stickers</th>
                      <th style={{ textAlign: "right" }}>Education Player</th>
                      <th style={{ textAlign: "right" }}>Shopping Star Bonus</th>
                      <th style={{ textAlign: "right" }}>Shopping Affiliate bonus</th>
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
                        <td style={{ textAlign: "right" }}>{money(row.membershipsRevenue || 0)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.superChatRevenue || 0)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.superThanksRevenue || 0)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.giftedMembershipsRevenue || 0)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.superStickersRevenue || 0)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.educationPlayerRevenue || 0)}</td>
                        <td style={{ textAlign: "right", color: (row.shoppingStarBonus || 0) > 0 ? "#db2777" : undefined, fontWeight: (row.shoppingStarBonus || 0) > 0 ? 700 : undefined }}>
                          {money(row.shoppingStarBonus || 0)}
                        </td>
                        <td style={{ textAlign: "right" }}>{money(row.shoppingAffiliateBonus || 0)}</td>
                      </tr>
                    ))}

                    {/* Next Month Forecast Row */}
                    {forecast && (selectedYear === "ALL" || selectedYear === String(forecast.currYear)) && (
                      <tr style={{ background: "#f0fdf4", borderTop: "1px dashed #34d399", color: "#166534" }}>
                        <td>
                          <strong>✨ {forecast.nextMonthLabel} (Forecast)</strong>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "#15803d" }}>
                          {money(forecast.nextMonthForecast)}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>
                          ~{money(forecast.nextMonthForecast * 0.70)}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>
                          ~{money(forecast.nextMonthForecast * 0.22)}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>
                          ~{money(forecast.nextMonthForecast * 0.04)}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>
                          ~{money(forecast.nextMonthForecast * 0.02)}
                        </td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                        <td style={{ textAlign: "right", color: "#64748b" }}>-</td>
                      </tr>
                    )}

                    {/* Summary Row */}
                    <tr style={{ background: "#f8fafc", fontWeight: "bold", borderTop: "2px solid #cbd5e1" }}>
                      <td>รวมทั้งหมด (Actual YTD)</td>
                      <td style={{ textAlign: "right", color: "#1e40af", fontSize: 14 }}>
                        {money(totals.estRevenue)}
                      </td>
                      <td style={{ textAlign: "right" }}>{money(totals.partnerAdRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.youtubePremiumRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.affiliateProgramRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.shortsFeedAdsRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.membershipsRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.superChatRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.superThanksRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.giftedMembershipsRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.superStickersRevenue)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.educationPlayerRevenue)}</td>
                      <td style={{ textAlign: "right", color: "#db2777" }}>{money(totals.shoppingStarBonus)}</td>
                      <td style={{ textAlign: "right" }}>{money(totals.shoppingAffiliateBonus)}</td>
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
