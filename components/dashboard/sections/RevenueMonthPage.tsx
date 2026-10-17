"use client";
// รายงานผล → one page of YouTube Revenue for the report's month: the imported
// revenue file (revenueData) and, for a month it has not got yet, the CMS API
// (revenueApi; its other columns are "รอสรุปผล"); CMS Channel: each channel's revenue
// from the CMS API (revenueApi.channels). Read by who may see revenue only.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coins, PlaySquare, TrendingDown, TrendingUp, Video, Wallet } from "lucide-react";
import type { MonthlyRevenueItem, RevenueData } from "@/lib/dashboard/revenueParser";
import { thDay, thMonth as thMonthShort, withApiMonths, type RevenueApiMonth, type RevenueItem } from "@/lib/dashboard/revenueApi";

const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (m: string) => `${TH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const usdShort = (v: number) => `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0)}`;
const thb = (v: number) => `฿${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(v || 0))}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Where the month's revenue goes, as the Revenue page groups it. */
const SOURCES: { label: string; color: string; of: (m: MonthlyRevenueItem) => number }[] = [
  { label: "Partner Ad Revenue", color: "#2563eb", of: (m) => m.partnerAdRevenue },
  { label: "YouTube Premium", color: "#7c3aed", of: (m) => m.youtubePremiumRevenue },
  { label: "Shorts Feed Ads", color: "#ea580c", of: (m) => m.shortsFeedAdsRevenue },
  { label: "Affiliate Program", color: "#059669", of: (m) => m.affiliateProgramRevenue },
  { label: "Shopping Star & Bonus", color: "#db2777", of: (m) => (m.shoppingStarBonus || 0) + (m.shoppingAffiliateBonus || 0) },
  {
    label: "Memberships & Supers",
    color: "#eab308",
    of: (m) => (m.membershipsRevenue || 0) + (m.superChatRevenue || 0) + (m.superThanksRevenue || 0) + (m.giftedMembershipsRevenue || 0) + (m.superStickersRevenue || 0),
  },
  { label: "Education Player", color: "#6366f1", of: (m) => m.educationPlayerRevenue || 0 },
];

/** The file's months plus the API's, as the Revenue page shows them. */
export const revenueMonths = (data: RevenueData | null, api: RevenueApiMonth[]): RevenueItem[] => withApiMonths(data?.monthly || [], api);
export const hasRevenueMonth = (months: RevenueItem[], month: string) => months.some((m) => m.month === month && m.estRevenue > 0);

export function RevenueMonthPage({ data, months, api, month }: { data: RevenueData | null; months: RevenueItem[]; api: RevenueApiMonth[]; month: string }) {
  const year = month.slice(0, 4);
  const cur = months.find((m) => m.month === month)!;
  const inYear = months.filter((m) => m.month.startsWith(year) && m.month <= month);
  const prev = inYear[inYear.length - 2];
  const ytd = inYear.reduce((a, m) => a + m.estRevenue, 0);
  const rate = data?.rates?.[month];
  const fromApi = !!cur.api;
  const change = (now: number, before?: number) => (before ? (now - before) / before : null);
  const Delta = ({ v }: { v: number | null }) =>
    v === null ? null : (
      <em className={v >= 0 ? "aff2-up" : "aff2-down"}>
        {v >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {v >= 0 ? "+" : ""}
        {pct(v)} จาก {thMonth(prev!.month)}
      </em>
    );
  const chart = inYear.map((m) => ({ label: thMonth(m.month), month: m.month, v: m.estRevenue, api: !!m.api }));
  const sources = SOURCES.map((s) => ({ ...s, v: s.of(cur) })).filter((s) => s.v > 0);
  // Every CMS channel that earned that month (from the API, collected by the sync).
  const apiMonth = api.find((a) => a.month === month);
  const channels = (apiMonth?.channels || []).filter((c) => c.revenue > 0);
  const channelTotal = channels.reduce((a, c) => a + c.revenue, 0);
  const top = channels[0]?.revenue || 1;
  return (
    <div className="aff2 aff2-month rev-month">
      <div className="aff2-month-top">
        <div className="affiliate-kpis aff2-kpis">
          <article>
            <Wallet style={{ color: "#2563eb" }} />
            <span>EST. Revenue {thMonth(month)}</span>
            <strong>{usd(cur.estRevenue)}</strong>
            <small>
              {rate ? `${thb(cur.estRevenue * rate)} · ` : ""}
              <Delta v={change(cur.estRevenue, prev?.estRevenue)} />
            </small>
          </article>
          <article>
            <PlaySquare style={{ color: "#0284c7" }} />
            <span>Partner Ad Revenue</span>
            <strong>{usd(cur.partnerAdRevenue)}</strong>
            <small>{pct(cur.estRevenue ? cur.partnerAdRevenue / cur.estRevenue : 0)} ของรายได้</small>
          </article>
          <article>
            <Video style={{ color: "#7c3aed" }} />
            <span>YouTube Premium</span>
            <strong>{usd(cur.youtubePremiumRevenue)}</strong>
            <small>{pct(cur.estRevenue ? cur.youtubePremiumRevenue / cur.estRevenue : 0)} ของรายได้</small>
          </article>
          <article>
            <Coins style={{ color: "#059669" }} />
            <span>สะสมปี {year} (ม.ค. – {TH[Number(month.slice(5, 7)) - 1]})</span>
            <strong>{usd(ytd)}</strong>
            <small>เฉลี่ย {usd(inYear.length ? ytd / inYear.length : 0)} / เดือน</small>
          </article>
        </div>
        <article className="panel aff2-month-chart">
          <div className="panel-head">
            <div>
              <h3>
                EST. Revenue รายเดือน ปี {year} · {thMonth(month)}
              </h3>
              <p>USD · แท่งจาง = เดือนจาก API (ประมาณการ)</p>
            </div>
          </div>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={usdShort} tick={{ fontSize: 10 }} width={48} />
                <Tooltip formatter={(v) => usd(Number(v))} />
                <Bar dataKey="v" name="EST. Revenue" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {chart.map((c) => (
                    <Cell key={c.month} fill="#2563eb" fillOpacity={c.month === month ? 1 : c.api ? 0.15 : 0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="rev-month-bottom">
        {/* Left: every CMS channel that earned · right: the month by revenue type. */}
        <article className="panel rev-month-channels">
          <div className="panel-head">
            <div>
              <h3>
                CMS Channel {thMonth(month)} · {channels.length} ช่องที่มีรายได้
              </h3>
              <p>
                จาก YouTube CMS API (ประมาณการ){apiMonth && !apiMonth.complete ? ` ถึง ${thDay(apiMonth.endDate)}` : ""} · รวมทุกช่อง {usd(channelTotal)}
              </p>
            </div>
          </div>
          {channels.length ? (
            <ul className="rev-month-sources rev-month-channel-list">
              {channels.map((c) => (
                <li key={c.id}>
                  <i style={{ background: "#2563eb" }} />
                  <span title={c.title}>{c.title}</span>
                  <span className="rev-month-bar">
                    <b style={{ width: `${Math.max(2, (c.revenue / top) * 100)}%`, background: "#2563eb" }} />
                  </span>
                  <strong>{usd(c.revenue)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rev-pending-cell rev-month-wait">รอข้อมูลรายช่องจาก sync ({thMonthShort(month)})</p>
          )}
        </article>
        <article className="panel rev-month-types">
          <div className="panel-head">
            <div>
              <h3>รายได้ {thMonth(month)} ตามประเภท</h3>
              <p>{fromApi ? `จาก API ถึง ${thDay(cur.api!.endDate)} · ประเภทอื่นรอสรุปผล ${thMonthShort(month)}` : "จากไฟล์ Revenue ที่นำเข้า"}</p>
            </div>
          </div>
          {fromApi ? (
            <p className="rev-pending-cell rev-month-wait">
              Partner Ad + Premium = {usd(cur.partnerAdRevenue + cur.youtubePremiumRevenue)} · อื่น ๆ {usd(Math.max(0, cur.estRevenue - cur.partnerAdRevenue - cur.youtubePremiumRevenue))} (รอสรุปผล {thMonthShort(month)})
            </p>
          ) : (
            <ul className="rev-month-sources">
              {sources.map((s) => (
                <li key={s.label}>
                  <i style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <span className="rev-month-bar">
                    <b style={{ width: `${Math.max(2, (s.v / (cur.estRevenue || 1)) * 100)}%`, background: s.color }} />
                  </span>
                  <strong>{usd(s.v)}</strong>
                  <small>{pct(cur.estRevenue ? s.v / cur.estRevenue : 0)}</small>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
