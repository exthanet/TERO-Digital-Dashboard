"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Mail,
  Plus,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth/types";
import { inviteMessage, isValidEmail } from "@/lib/auth/validation";
import { isCompanyEmail } from "@/lib/auth/microsoft";
import { bangkokDay, listDownloads, listVisits, usageByPerson, type Download, type Visit } from "@/lib/auth/activity";

type Period = "month" | "last" | "3m";
/** First day (Bangkok) of the period, and the day it ends (inclusive). */
function periodRange(p: Period): { from: string; to: string; label: string } {
  const today = bangkokDay();
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  if (p === "last") {
    const from = first(y, m - 1);
    const to = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return { from, to, label: "เดือนที่แล้ว" };
  }
  if (p === "3m") return { from: first(y, m - 2), to: today, label: "3 เดือนล่าสุด" };
  return { from: first(y, m), to: today, label: "เดือนนี้" };
}
const KIND_LABEL: Record<string, string> = {
  "csv-performance": "CSV ผลงานรายเทป",
  "csv-search": "CSV ผลการค้นหา",
  "excel-monthly-acc": "Excel Monthly ACC",
  "backup-zip": "Backup zip (GitHub)",
};

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
  // Shown once after an invite: the admin copies it and sends it to the person.
  const [invited, setInvited] = useState<{ email: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [downloads, setDownloads] = useState<Download[] | null>(null);

  const { refreshUsers } = auth;
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    refreshUsers().catch(() => setError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
  }, [isOpen, refreshUsers]);

  useEffect(() => {
    if (!isOpen || tab !== "usage") return;
    const { from, to } = periodRange(period);
    setVisits(null);
    setDownloads(null);
    listVisits(from)
      .then((v) => setVisits(v.filter((x) => x.day <= to)))
      .catch(() => {
        setVisits([]);
        setError("โหลดประวัติการเข้าใช้ไม่สำเร็จ");
      });
    listDownloads(new Date(`${from}T00:00:00+07:00`))
      .then((d) => setDownloads(d.filter((x) => bangkokDay(new Date(x.at)) <= to)))
      .catch(() => setDownloads([]));
  }, [isOpen, tab, period]);

  const usage = useMemo(() => {
    const byUser = usageByPerson(visits || []);
    const recent = new Date(Date.now() - 30 * 86400000).toISOString();
    return auth.allUsers
      .filter((u) => u.active)
      .map((u) => {
        const x = byUser.get(u.id);
        return { user: u, count: x?.days || 0, opens: x?.opens || 0, last: x?.last || "", methods: [...(x?.methods || [])], isNew: !!u.createdAt && u.createdAt >= recent };
      })
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
  }, [visits, auth.allUsers]);

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
    // Company accounts sign in with Microsoft and get a viewer profile by themselves.
    if (isCompanyEmail(email)) {
      setError("ไม่ต้องสร้างบัญชีให้ @terodigital.com · ให้กด “เข้าสู่ระบบด้วย Microsoft” ที่หน้าล็อกอิน จะได้สิทธิ์ viewer อัตโนมัติ แล้วปรับสิทธิ์ในรายการด้านล่างได้");
      return;
    }
    setError(null);
    setSuccess(null);
    setInvited(null);
    setBusy("invite");
    const res = await auth.inviteUser({ email, name, role });
    setBusy(null);
    if (!res.success || !res.tempPassword) {
      setError(res.error || "สร้างผู้ใช้ไม่สำเร็จ");
      return;
    }
    const address = email.trim().toLowerCase();
    setInvited({ email: address, message: inviteMessage(name.trim(), address, res.tempPassword, window.location.origin) });
    setCopied(false);
    setEmail("");
    setName("");
    setRole("viewer");
    setShowAddUser(false);
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

          {tab === "users" && invited && (
            <div className="invite-result">
              <b>
                <KeyRound size={16} /> สร้างบัญชี {invited.email} แล้ว · ส่งข้อความนี้ให้ผู้ใช้
              </b>
              <pre>{invited.message}</pre>
              <div className="invite-result-actions">
                <button
                  type="button"
                  className="auth-btn-primary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(invited.message).then(() => setCopied(true));
                  }}
                >
                  <Copy size={15} /> {copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
                </button>
                <button type="button" className="auth-btn-secondary" onClick={() => setInvited(null)}>
                  เสร็จแล้ว
                </button>
              </div>
              <small>รหัสชั่วคราวแสดงครั้งเดียว ระบบไม่ได้เก็บไว้ · ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าระบบครั้งแรก</small>
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
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
                    สำหรับคนนอกบริษัทเท่านั้น · พนักงาน @terodigital.com ไม่ต้องเชิญ ให้กด “เข้าสู่ระบบด้วย Microsoft” ครั้งแรกจะได้สิทธิ์ viewer อัตโนมัติ แล้วปรับเป็น admin หรือปิดบัญชีในรายการด้านล่าง
                  </p>

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
                    ระบบจะสร้างรหัสผ่านชั่วคราวให้ คุณส่งให้ผู้ใช้เอง (LINE / อีเมล) ผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าระบบครั้งแรก
                  </p>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      className="auth-btn-primary"
                      style={{ width: "auto", margin: 0, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                      disabled={busy === "invite"}
                    >
                      {busy === "invite" ? "กำลังสร้าง..." : "สร้างบัญชี"}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}>
                  {visits === null ? "กำลังโหลด..." : `เข้าใช้แล้ว ${usedCount} จาก ${activeCount} คน · ${periodRange(period).label}`}
                </p>
                <div className="segmented" aria-label="ช่วงเวลา">
                  {(["month", "last", "3m"] as const).map((p) => (
                    <button key={p} type="button" className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
                      {periodRange(p).label}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                นับวันที่เปิด dashboard (ทั้งล็อกอินใหม่และที่ยังล็อกอินค้างไว้) · 1 วันนับครั้งเดียว · เริ่มเก็บตั้งแต่ ต.ค. 2026 ข้อมูลก่อนหน้านั้นไม่มี
              </p>
              <div className="auth-users-table-wrap" style={{ maxHeight: 320 }}>
                <table className="auth-users-table">
                  <thead>
                    <tr>
                      <th>ผู้ใช้</th>
                      <th>จำนวนวัน</th>
                      <th>เปิด (ครั้ง)</th>
                      <th>เข้าด้วย</th>
                      <th>เข้าใช้ล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((x) => (
                      <tr key={x.user.id} style={x.count ? undefined : { background: "#fff7ed" }}>
                        <td className="auth-user-cell">
                          <strong>
                            {x.user.name}
                            {x.isNew && <span className="auth-new-pill">ใหม่ · {dateTime(x.user.createdAt)}</span>}
                          </strong>
                          <small>
                            {x.user.email} · {x.user.role}
                          </small>
                        </td>
                        <td>{x.count}</td>
                        <td>{x.opens}</td>
                        <td>{x.methods.map((m) => (m === "microsoft" ? "Microsoft" : m === "password" ? "รหัสผ่าน" : m)).join(", ") || "-"}</td>
                        <td style={{ color: x.count ? "#334155" : "#c2410c" }}>{x.count ? dateTime(x.last) : "ยังไม่เข้าใช้ในช่วงนี้"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f1b31", marginTop: "0.5rem" }}>ดาวน์โหลดไฟล์ · {periodRange(period).label}</div>
              {downloads === null ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>กำลังโหลด...</p>
              ) : downloads.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>ยังไม่มีการดาวน์โหลดในช่วงนี้</p>
              ) : (
                <div className="auth-users-table-wrap" style={{ maxHeight: 260 }}>
                  <table className="auth-users-table">
                    <thead>
                      <tr>
                        <th>เวลา</th>
                        <th>ผู้ใช้</th>
                        <th>ไฟล์</th>
                        <th>แถว</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downloads.map((d) => (
                        <tr key={d.id}>
                          <td>{dateTime(d.at)}</td>
                          <td className="auth-user-cell">
                            <strong>{d.name || d.email}</strong>
                            {d.name && <small>{d.email}</small>}
                          </td>
                          <td className="auth-user-cell">
                            <strong>{KIND_LABEL[d.kind] || d.kind}</strong>
                            <small>{d.file}</small>
                          </td>
                          <td>{d.rows ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
