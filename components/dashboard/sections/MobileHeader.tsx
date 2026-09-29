"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { Menu, Upload, X } from "lucide-react";
export function MobileHeader({
  menuOpen,
  setMenuOpen,
  setSourceOpen,
  canImport,
}: Pick<DashboardModel, "menuOpen" | "setMenuOpen" | "setSourceOpen"> & {
  canImport?: boolean;
}) {
  return (
    <>
      <header className="mobile-header">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <strong>Entertainment Dashboard</strong>
        {canImport ? (
          <button
            type="button"
            onClick={() => setSourceOpen(true)}
            aria-label="นำเข้าข้อมูล"
          >
            <Upload />
          </button>
        ) : (
          <span className="mobile-header-spacer" />
        )}
      </header>
    </>
  );
}
