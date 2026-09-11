"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Shield,
  User as UserIcon,
  UserPlus,
  Users,
} from "lucide-react";
import type { User as AuthUser } from "@/lib/auth/types";

interface UserDropdownMenuProps {
  currentUser: AuthUser | null;
  onOpenSignUp: () => void;
  onOpenChangePassword: () => void;
  onOpenUserManagement: () => void;
  onLogout: () => void;
}

export function UserDropdownMenu({
  currentUser,
  onOpenSignUp,
  onOpenChangePassword,
  onOpenUserManagement,
  onLogout,
}: UserDropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!currentUser) return null;

  const initial = currentUser.name
    ? currentUser.name.charAt(0).toUpperCase()
    : "U";

  return (
    <div className="user-dropdown-container" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`user-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="เมนูผู้ใช้งาน (User Menu)"
      >
        <div className="user-dropdown-avatar">
          {initial}
        </div>
        <span className="user-dropdown-name">{currentUser.name}</span>
        <ChevronDown
          size={14}
          className={`user-dropdown-chevron ${isOpen ? "rotate" : ""}`}
        />
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="user-dropdown-menu">
          {/* User Info Header */}
          <div className="user-dropdown-header">
            <div className="user-dropdown-header-avatar">
              {initial}
            </div>
            <div className="user-dropdown-header-meta">
              <div className="user-dropdown-header-name" title={currentUser.name}>
                {currentUser.name}
              </div>
              <div className="user-dropdown-header-username">
                @{currentUser.username}
              </div>
              <span className={`auth-role-pill ${currentUser.role}`}>
                <Shield size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} />
                {currentUser.role}
              </span>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          {/* Menu Items */}
          <div className="user-dropdown-list">
            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onOpenSignUp();
              }}
            >
              <UserPlus size={16} className="user-dropdown-item-icon text-primary" />
              <span>สมัครสมาชิกใหม่ (Sign Up)</span>
            </button>

            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onOpenChangePassword();
              }}
            >
              <KeyRound size={16} className="user-dropdown-item-icon" />
              <span>เปลี่ยนรหัสผ่าน (Change Password)</span>
            </button>

            <button
              type="button"
              className="user-dropdown-item"
              onClick={() => {
                setIsOpen(false);
                onOpenUserManagement();
              }}
            >
              <Users size={16} className="user-dropdown-item-icon" />
              <span>จัดการผู้ใช้งาน (User Management)</span>
            </button>

            <div className="user-dropdown-divider" />

            <button
              type="button"
              className="user-dropdown-item logout"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
            >
              <LogOut size={16} className="user-dropdown-item-icon" />
              <span>ออกจากระบบ (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
