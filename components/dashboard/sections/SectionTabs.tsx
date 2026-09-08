"use client";
import { BadgeDollarSign, LayoutDashboard } from "lucide-react";
export function SectionTabs() {
  return (
    <>
      <nav className="top-tab-bar" aria-label="Dashboard sections">
        <a className="active" href="#overview">
          <LayoutDashboard />
          Performance Dashboard
        </a>
        <a href="#affiliate">
          <BadgeDollarSign />
          Affiliate Program Report
        </a>
      </nav>
    </>
  );
}
