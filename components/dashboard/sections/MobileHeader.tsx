"use client";
import type { DashboardModel } from "@/hooks/useDashboard";
import { Menu, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
// Importing master data is desktop-only, so the phone header has no upload button.
export function MobileHeader({
  menuOpen,
  setMenuOpen,
}: Pick<DashboardModel, "menuOpen" | "setMenuOpen">) {
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
        <strong>{BRAND.product}</strong>
        <span className="mobile-header-spacer" />
      </header>
    </>
  );
}
