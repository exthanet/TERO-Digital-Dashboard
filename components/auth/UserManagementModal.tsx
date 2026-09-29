"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Plus,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import type { LoginEvent, UserRole } from "@/lib/auth/types";
import { isValidEmail } from "@/lib/auth/validation";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: AuthState;
}

const dateTime = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "-";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function UserManagementModal({
  isOpen,
  onClose,
  auth,
}: UserManagementModalProps) {
  const [tab, setTab] = useState<"users" | "usage">("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [events, setEvents] = useState<LoginEvent[] | null>(null);

  const { refreshUsers, loadLoginEvents } = auth;
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    refreshUsers().catch(() => setError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
  }, [isOpen, refreshUsers]);

  useEffect(() => {
    if (!isOpen || tab !== "usage") return;
    setEvents(null);
    loadLoginEvents(startOfMonth())
      .then(setEvents)
      .catch(() => {
        setEvents([]);
        setError("โหลดประวัติการเข้าใช้ไม่สำเร็จ");
      });
  }, [isOpen, tab, loadLoginEvents]);

  const usage = useMemo(() => {
    const byUser = new Map<string, { count: number; last: string }>();
    (events || []).forEach((e) => {
      const x = byUser.get(e.uid) || { count: 0, last: "" };
      x.count += 1;
      if (e.at > x.last) x.last = e.at;
      byUser.set(e.uid, x);
    });
    return auth.allUsers
      .filter((u) => u.active)
      .map((u) => ({ user: u, ...(byUser.get(u.id) || { count: 0, last: "" }) }))
      .sort((a, b) => b.count - a.count);
  }, [events, auth.allUsers]);

  if (!isOpen) return null;

  const flash = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 4000);
  };

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setError(null);
    setSuccess(null);
    setBusy(key);
    const res = await action();
    setBusy(null);
    if (res.success) flash(done);
    else setError(res.error || "ทำรายการไม่สำเร็จ");
    return res.success;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    const ok = await run(
      "invite",
      () => auth.inviteUser({ email, name, role }),
      `สร้างบัญชี ${email.trim()} แล้ว และส่งอีเมลให้ตั้งรหัสผ่านเรียบร้อย`,
    );
    if (ok) {
      setEmail("");
      setName("");
      setRole("viewer");
      setShowAddUser(false);
    }
  };

  const activeCount = usage.length;
  const usedCount = usage.filter((x) => x.count > 0).length;

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        style={{ maxWidth: "720px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-modal-header">
          <h3 className="auth-modal-title">
            <Users size={20} className="text-primary" />
            จัดการผู้ใช้งานระบบ (User Management)
          </h3>
          <button
            type="button"
            className="auth-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="auth-modal-body">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={tab === "users" ? "active" : ""}
              onClick={() => setTab("users")}
            >
              ผู้ใช้ ({auth.allUsers.length})
            </button>
            <button
              type="button"
              className={tab === "usage" ? "active" : ""}
              onClick={() => setTab("usage")}
            >
              การเข้าใช้เดือนนี้
            </button>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="auth-info">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {tab === "users" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="auth-btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}
                  onClick={() => setShowAddUser(!showAddUser)}
                >
                  <Plus size={16} />
                  {showAddUser ? "ปิดฟอร์ม" : "เพิ่มผู้ใช้ใหม่"}
                </button>
              </div>

              {showAddUser && (
                <form
                  onSubmit={handleInvite}
                  style={{
                    background: "#f8fafc",
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f1b31" }}>
                    <UserPlus size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                    เชิญผู้ใช้ใหม่
                  </div>

                  <div className="auth-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="auth-field">
                      <label className="auth-label">อีเมล*</label>
                      <div className="auth-input-wrap">
                        <Mail className="auth-input-icon" />
                        <input
                          type="email"
                          className="auth-input"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">ชื่อที่แสดง</label>
                      <div className="auth-input-wrap">
                        <User className="auth-input-icon" />
                        <input
                          type="text"
                          className="auth-input"
                          placeholder="เช่น สมศักดิ์"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">สิทธิ์การใช้งาน (Role)</label>
                      <div className="auth-input-wrap">
                        <Shield className="auth-input-icon" />
                        <select
                          className="auth-input"
                          value={role}
                          onChange={(e) => setRole(e.target.value as UserRole)}
                        >
                          <option value="viewer">Viewer (ผู้บริหาร / หัวหน้ารายการ)</option>
                          <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
                    ระบบจะส่งอีเมลให้ผู้ใช้ตั้งรหัสผ่านเอง ผู้ดูแลไม่ต้องรู้รหัสของใคร
                  </p>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      className="auth-btn-primary"
                      style={{ width: "auto", margin: 0, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                      disabled={busy === "invite"}
                    >
                      {busy === "invite" ? "กำลังสร้าง..." : "สร้างบัญชีและส่งอีเมลเชิญ"}
                    </button>
                  </div>
                </form>
              )}

              <div className="auth-users-table-wrap" style={{ maxHeight: 360 }}>
                <table className="auth-users-table">
                  <thead>
                    <tr>
                      <th>ผู้ใช้</th>
                      <th>สิทธิ์</th>
                      <th>สถานะ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {auth.allUsers.map((u) => {
                      const isSelf = u.id === auth.user?.id;
                      return (
                        <tr key={u.id}>
                          <td className="auth-user-cell">
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </td>
                          <td>
                            <select
                              value={u.role}
                              disabled={isSelf || busy !== null}
                              title={isSelf ? "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" : undefined}
                              onChange={(e) =>
                                run(`role-${u.id}`, () => auth.setUserRole(u.id, e.target.value as UserRole), `เปลี่ยนสิทธิ์ของ ${u.email} แล้ว`)
                              }
                            >
                              <option value="viewer">viewer</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td>
                            <span className={`auth-status-pill ${u.active ? "on" : "off"}`}>
                              {u.active ? "ใช้งาน" : "ปิดใช้งาน"}
                            </span>
                          </td>
                          <td style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="auth-mini-btn"
                              disabled={busy !== null || !u.active}
                              onClick={() =>
                                run(`reset-${u.id}`, () => auth.requestPasswordReset(u.email), `ส่งอีเมลตั้งรหัสผ่านใหม่ไปที่ ${u.email} แล้ว`)
                              }
                            >
                              ส่งอีเมลรีเซ็ตรหัส
                            </button>
                            <button
                              type="button"
                              className={`auth-mini-btn ${u.active ? "danger" : ""}`}
                              disabled={isSelf || busy !== null}
                              title={isSelf ? "ปิดบัญชีของตัวเองไม่ได้" : undefined}
                              onClick={() => {
                                if (u.active && !window.confirm(`ปิดการใช้งานบัญชี ${u.email}?`)) return;
                                void run(
                                  `active-${u.id}`,
                                  () => auth.setUserActive(u.id, !u.active),
                                  u.active ? `ปิดบัญชี ${u.email} แล้ว` : `เปิดบัญชี ${u.email} แล้ว`,
                                );
                              }}
                            >
                              {u.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "usage" && (
            <>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}>
                {events === null
                  ? "กำลังโหลด..."
                  : `เข้าใช้แล้ว ${usedCount} จาก ${activeCount} คน ตั้งแต่วันที่ 1 ของเดือนนี้`}
              </p>
              <div className="auth-users-table-wrap" style={{ maxHeight: 360 }}>
                <table className="auth-users-table">
                  <thead>
                    <tr>
                      <th>ผู้ใช้</th>
                      <th>จำนวนครั้ง</th>
                      <th>เข้าใช้ล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((x) => (
                      <tr key={x.user.id} style={x.count ? undefined : { background: "#fff7ed" }}>
                        <td className="auth-user-cell">
                          <strong>{x.user.name}</strong>
                          <small>{x.user.email}</small>
                        </td>
                        <td>{x.count}</td>
                        <td style={{ color: x.count ? "#334155" : "#c2410c" }}>
                          {x.count ? dateTime(x.last) : "ยังไม่เข้าใช้เดือนนี้"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="auth-modal-footer">
          <button type="button" className="auth-btn-secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
