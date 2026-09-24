"use client";

import { BadgeDollarSign, LayoutDashboard } from "lucide-react";
import type { User as AuthUser } from "@/lib/auth/types";
import { UserDropdownMenu } from "@/components/auth/UserDropdownMenu";

interface SectionTabsProps {
  activeTab: "overview" | "revenue" | "affiliate";
  onTabChange: (tab: "overview" | "revenue" | "affiliate") => void;
  currentUser?: AuthUser | null;
  onOpenSignUp?: () => void;
  onOpenChangePassword?: () => void;
  onOpenUserManagement?: () => void;
  onLogout?: () => void;
}

export function SectionTabs({
  activeTab,
  onTabChange,
  currentUser,
  onOpenSignUp,
  onOpenChangePassword,
  onOpenUserManagement,
  onLogout,
}: SectionTabsProps) {
  return (
    <nav className="top-tab-bar" aria-label="Dashboard sections">
      <div className="top-tabs-group">
        <button
          type="button"
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => onTabChange("overview")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 15px",
            borderRadius: 9,
            fontWeight: 800,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            background: activeTab === "overview" ? "#fff" : "transparent",
            color: activeTab === "overview" ? "#0757e8" : "#53627a",
            boxShadow: activeTab === "overview" ? "0 3px 8px #16305b18" : "none",
            transition: "0.2s",
          }}
        >
          <LayoutDashboard size={16} />
          Performance Dashboard
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "revenue" ? "active" : ""}`}
          onClick={() => onTabChange("revenue")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 15px",
            borderRadius: 9,
            fontWeight: 800,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            background: activeTab === "revenue" ? "#fff" : "transparent",
            color: activeTab === "revenue" ? "#2563eb" : "#53627a",
            boxShadow: activeTab === "revenue" ? "0 3px 8px #16305b18" : "none",
            transition: "0.2s",
          }}
        >
          <BadgeDollarSign size={16} />
          YouTube Revenue Report
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "affiliate" ? "active" : ""}`}
          onClick={() => onTabChange("affiliate")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 15px",
            borderRadius: 9,
            fontWeight: 800,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            background: activeTab === "affiliate" ? "#fff" : "transparent",
            color: activeTab === "affiliate" ? "#0f766e" : "#53627a",
            boxShadow: activeTab === "affiliate" ? "0 3px 8px #16305b18" : "none",
            transition: "0.2s",
          }}
        >
          <BadgeDollarSign size={16} />
          Affiliate Program Report
        </button>
      </div>

      {currentUser && (
        <UserDropdownMenu
          currentUser={currentUser}
          onOpenSignUp={onOpenSignUp || (() => {})}
          onOpenChangePassword={onOpenChangePassword || (() => {})}
          onOpenUserManagement={onOpenUserManagement || (() => {})}
          onLogout={onLogout || (() => {})}
        />
      )}
    </nav>
  );
}
