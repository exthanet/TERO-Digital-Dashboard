"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { Menu, Upload } from "lucide-react";
export function MobileHeader({
  menuOpen,
  setMenuOpen,
  setSourceOpen,
}: Pick<DashboardModel, "menuOpen" | "setMenuOpen" | "setSourceOpen">) {
  return (
    <>
      <header className="mobile-header">
        <button onClick={() => setMenuOpen(!menuOpen)}>
          <Menu />
        </button>
        <strong>Entertainment Dashboard</strong>
        <button onClick={() => setSourceOpen(true)}>
          <Upload />
        </button>
      </header>
    </>
  );
}
