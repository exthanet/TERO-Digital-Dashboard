"use client";
import { useEffect } from "react";
import type { DashboardModel } from "@/hooks/useDashboard";
import type { User as AuthUser } from "@/lib/auth/types";
import { num } from "@/lib/dashboard/format";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  ListOrdered,
  MonitorPlay,
  RefreshCw,
  Sparkles,
  Trophy,
  Tv,
  Upload,
  User as UserIcon,
  X,
  Zap,
} from "lucide-react";

interface DashboardSidebarProps
  extends Pick<
    DashboardModel,
    "rows" | "menuOpen" | "setMenuOpen" | "setSourceOpen"
  > {
  currentUser?: AuthUser | null;
  activeTab?: "overview" | "revenue" | "affiliate";
  onTabChange?: (tab: "overview" | "revenue" | "affiliate") => void;
  openSyncStatus?: () => void;
}

export function DashboardSidebar({
  rows,
  menuOpen,
  setMenuOpen,
  setSourceOpen,
  openSyncStatus,
  currentUser,
  activeTab = "overview",
  onTabChange,
}: DashboardSidebarProps) {
  const nav = [
    ["overview", "ภาพรวม", <LayoutDashboard key="a" />],
    ["ranking", "Ranking ดี/แย่", <ListOrdered key="rk" />],
    ["ai-analysis", "AI Executive Analysis", <Sparkles key="ai" />],
    ["daily", "ประสิทธิภาพรายวัน", <Activity key="b" />],
    ["programs", "รายการ", <MonitorPlay key="c" />],
    ["platforms", "แพลตฟอร์ม", <BarChart3 key="d" />],
    ["topics", "ประเภทเนื้อหา", <Sparkles key="e" />],
    ["rating", "TV Rating", <Tv key="f" />],
    ["revenue", "YouTube Revenue", <BadgeDollarSign key="revenue" />],
    ["affiliate", "Affiliate Program", <BadgeDollarSign key="affiliate" />],
    ["best", "Best of Month", <Trophy key="g" />],
    ["compare", "ผลงานรายเทป", <FileSpreadsheet key="h" />],
  ];

  // Mobile drawer: Esc closes it and the page behind it stops scrolling.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  const handleNavClick = (id: string) => {
    setMenuOpen(false);
    if (id === "revenue") {
      if (onTabChange) onTabChange("revenue");
    } else if (id === "affiliate") {
      if (onTabChange) onTabChange("affiliate");
    } else {
      if (onTabChange && activeTab !== "overview") {
        onTabChange("overview");
      }
    }
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="ปิดเมนู"
        >
          <X />
        </button>
        <div className="brand">
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
              onClick={() => handleNavClick(String(id))}
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
        {currentUser?.role === "admin" && (
          <button className="sidebar-api mobile-hide" onClick={openSyncStatus}>
            <RefreshCw />
            สถานะการ Sync
          </button>
        )}
        {/* Admins only, and desktop only (not offered on phones) */}
        {currentUser?.role === "admin" && (
          <button
            className="sidebar-import mobile-hide"
            onClick={() => {
              setSourceOpen(true);
              setMenuOpen(false);
            }}
          >
            <Upload />
            Import Excel / CSV
          </button>
        )}

        {currentUser && (
          <div className="sidebar-user-widget">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                {currentUser.name ? (
                  currentUser.name.charAt(0).toUpperCase()
                ) : (
                  <UserIcon size={18} />
                )}
              </div>
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name" title={currentUser.name}>
                  {currentUser.name}
                </div>
                <div className={`sidebar-user-role ${currentUser.role}`}>
                  {currentUser.email} • {currentUser.role}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
