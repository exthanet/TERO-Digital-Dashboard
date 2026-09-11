"use client";

import { BadgeDollarSign, LayoutDashboard } from "lucide-react";
import type { User as AuthUser } from "@/lib/auth/types";
import { UserDropdownMenu } from "@/components/auth/UserDropdownMenu";

interface SectionTabsProps {
  currentUser?: AuthUser | null;
  onOpenSignUp?: () => void;
  onOpenChangePassword?: () => void;
  onOpenUserManagement?: () => void;
  onLogout?: () => void;
}

export function SectionTabs({
  currentUser,
  onOpenSignUp,
  onOpenChangePassword,
  onOpenUserManagement,
  onLogout,
}: SectionTabsProps) {
  return (
    <nav className="top-tab-bar" aria-label="Dashboard sections">
      <div className="top-tabs-group">
        <a className="active" href="#overview">
          <LayoutDashboard />
          Performance Dashboard
        </a>
        <a href="#affiliate">
          <BadgeDollarSign />
          Affiliate Program Report
        </a>
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
