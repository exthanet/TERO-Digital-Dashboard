"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Shield,
  User,
  UserPlus,
  X,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/auth/types";

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: AuthState;
}

export function SignUpModal({ isOpen, onClose, auth }: SignUpModalProps) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setError("ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      setError("ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลขเท่านั้น");
      return;
    }
    if (!password || password.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      // If admin is creating user, preserve admin session and use adminCreateUser
      const isAdmin = auth.user?.role === "admin";
      const res = isAdmin
        ? await auth.adminCreateUser({
            username: cleanUsername,
            name: name.trim() || cleanUsername,
            password,
            role,
          })
        : await auth.signup({
            username: cleanUsername,
            name: name.trim() || cleanUsername,
            password,
            role: "viewer",
          });

      if (res.success) {
        setSuccess(`สมัครสมาชิกสำหรับ "${cleanUsername}" สำเร็จเรียบร้อย`);
        setUsername("");
        setName("");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);
      } else {
        setError(res.error || "สมัครสมาชิกไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setUsername("");
    setName("");
    setPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <div className="auth-modal-backdrop" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3 className="auth-modal-title">
            <UserPlus size={20} className="text-primary" />
            สมัครสมาชิกใหม่ / เพิ่มผู้ใช้งาน (Sign Up)
          </h3>
          <button
            type="button"
            className="auth-modal-close"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

            <div className="auth-field">
              <label className="auth-label" htmlFor="su-username">
                ชื่อผู้ใช้ (Username)*
              </label>
              <div className="auth-input-wrap">
                <User className="auth-input-icon" />
                <input
                  id="su-username"
                  type="text"
                  className="auth-input"
                  placeholder="เช่น john_doe (ภาษาอังกฤษ/ตัวเลข)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="su-name">
                ชื่อ-นามสกุล / ชื่อที่แสดง
              </label>
              <div className="auth-input-wrap">
                <User className="auth-input-icon" />
                <input
                  id="su-name"
                  type="text"
                  className="auth-input"
                  placeholder="เช่น สมชาย ใจดี"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {auth.user?.role === "admin" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="su-role">
                  สิทธิ์การใช้งาน (Role)
                </label>
                <div className="auth-input-wrap">
                  <Shield className="auth-input-icon" />
                  <select
                    id="su-role"
                    className="auth-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                  >
                    <option value="viewer">Viewer (ผู้ดูรายงาน)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="su-password">
                รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="su-password"
                  type="password"
                  className="auth-input"
                  placeholder="ตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="su-confirm">
                ยืนยันรหัสผ่านอีกครั้ง*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="su-confirm"
                  type="password"
                  className="auth-input"
                  placeholder="กรอกรหัสผ่านเดิมอีกครั้ง"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="auth-modal-footer">
            <button
              type="button"
              className="auth-btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="auth-btn-primary"
              style={{ width: "auto", margin: 0, padding: "0.6rem 1.25rem" }}
              disabled={loading || !!success}
            >
              {loading ? "กำลังบันทึก..." : "ยืนยันสมัครสมาชิก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
