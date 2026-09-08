"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { num } from "@/lib/dashboard/format";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  MonitorPlay,
  Settings,
  Sparkles,
  Trophy,
  Tv,
  Upload,
  Zap,
} from "lucide-react";
export function DashboardSidebar({
  rows,
  menuOpen,
  setMenuOpen,
  setSourceOpen,
  openIntegrations,
}: Pick<
  DashboardModel,
  "rows" | "menuOpen" | "setMenuOpen" | "setSourceOpen" | "openIntegrations"
>) {
  const nav = [
    ["overview", "ภาพรวม", <LayoutDashboard key="a" />],
    ["ai-analysis", "AI Executive Analysis", <Sparkles key="ai" />],
    ["daily", "ประสิทธิภาพรายวัน", <Activity key="b" />],
    ["programs", "รายการ", <MonitorPlay key="c" />],
    ["platforms", "แพลตฟอร์ม", <BarChart3 key="d" />],
    ["topics", "ประเภทเนื้อหา", <Sparkles key="e" />],
    ["rating", "TV Rating", <Tv key="f" />],
    ["affiliate", "Affiliate Program", <BadgeDollarSign key="affiliate" />],
    ["best", "Best of Month", <Trophy key="g" />],
    ["compare", "Compare Table", <FileSpreadsheet key="h" />],
  ];
  return (
    <>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="live-mark">LIVE</div>
          <p>ข่าว /</p>
          <h1>
            ENTERTAINMENT
            <br />
            DASHBOARD
          </h1>
        </div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <a
              key={String(id)}
              href={`#${id}`}
              onClick={() => setMenuOpen(false)}
            >
              {icon}
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Zap />
          <div>
            <strong>Data status</strong>
            <span>{num(rows.length)} records</span>
            <small>Metricool delay 2–3 วัน</small>
          </div>
        </div>
        <button className="sidebar-api" onClick={openIntegrations}>
          <Settings />
          ตั้งค่า API Sync
        </button>
        <button
          className="sidebar-import"
          onClick={() => {
            setSourceOpen(true);
            setMenuOpen(false);
          }}
        >
          <Upload />
          Import Excel / CSV
        </button>
      </aside>
    </>
  );
}
