"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth/types";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: AuthState;
}

export function UserManagementModal({
  isOpen,
  onClose,
  auth,
}: UserManagementModalProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username.trim() || username.trim().length < 3) {
      setError("ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (!password || password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.adminCreateUser({
        username: username.trim(),
        name: name.trim() || username.trim(),
        password,
        role,
      });

      if (res.success) {
        setSuccess(`สร้างผู้ใช้ "${username}" สำเร็จเรียบร้อย`);
        setUsername("");
        setName("");
        setPassword("");
        setRole("viewer");
        setShowAddUser(false);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(res.error || "สร้างผู้ใช้ไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการสร้างผู้ใช้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        style={{ maxWidth: "560px" }}
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
          {error && (
            <div className="auth-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#16a34a",
                padding: "0.65rem 0.85rem",
                borderRadius: "0.65rem",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          {/* Action Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155" }}>
              รายชื่อผู้ใช้ทั้งหมด ({auth.allUsers.length} คน)
            </span>
            <button
              type="button"
              className="auth-btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.8rem",
              }}
              onClick={() => setShowAddUser(!showAddUser)}
            >
              <Plus size={16} />
              {showAddUser ? "ปิดฟอร์ม" : "เพิ่มผู้ใช้ใหม่"}
            </button>
          </div>

          {/* Add User Form Drawer */}
          {showAddUser && (
            <form
              onSubmit={handleCreateUser}
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
                สร้างผู้ใช้ใหม่
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="auth-field">
                  <label className="auth-label">Username*</label>
                  <div className="auth-input-wrap">
                    <User className="auth-input-icon" />
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="เช่น john"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="auth-field">
                  <label className="auth-label">รหัสผ่านเริ่มต้น*</label>
                  <div className="auth-input-wrap">
                    <Lock className="auth-input-icon" />
                    <input
                      type="password"
                      className="auth-input"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
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
                      <option value="viewer">Viewer (ผู้ดูรายงาน)</option>
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="submit"
                  className="auth-btn-primary"
                  style={{ width: "auto", margin: 0, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                  disabled={loading}
                >
                  {loading ? "กำลังบันทึก..." : "ยืนยันสร้างผู้ใช้"}
                </button>
              </div>
            </form>
          )}

          {/* User Table */}
          <div className="auth-users-table-wrap">
            <table className="auth-users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>ชื่อที่แสดง</th>
                  <th>สิทธิ์</th>
                  <th>วันที่สร้าง</th>
                </tr>
              </thead>
              <tbody>
                {auth.allUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.username}</strong>
                    </td>
                    <td>{u.name}</td>
                    <td>
                      <span className={`auth-role-pill ${u.role}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ color: "#64748b", fontSize: "0.8rem" }}>
                      {new Date(u.createdAt).toLocaleDateString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="auth-modal-footer">
          <button
            type="button"
            className="auth-btn-secondary"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
