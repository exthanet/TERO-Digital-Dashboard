"use client";

import React, { useState } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, LogOut } from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/auth/validation";
import { BRAND } from "@/lib/brand";

/**
 * First sign-in with the temporary password an admin sent: the person sets
 * their own password before the dashboard opens.
 */
export function FirstPasswordScreen({ auth }: { auth: AuthState }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("รหัสผ่านทั้ง 2 ช่องไม่ตรงกัน");
    setSaving(true);
    const res = await auth.setFirstPassword(password);
    setSaving(false);
    // On success the profile flag clears and the dashboard opens by itself.
    if (!res.success) setError(res.error || "ตั้งรหัสผ่านไม่สำเร็จ");
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-ambient-glow" />
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="live-dot" />
            {BRAND.company}
          </div>
          <h1 className="auth-title">ยินดีต้อนรับ</h1>
          <p className="auth-subtitle">
            {auth.user?.name ? `${auth.user.name} · ` : ""}ตั้งรหัสผ่านของคุณเองแทนรหัสชั่วคราว ก่อนเริ่มใช้งาน
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {error && (
            <div className="auth-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="first-password">
              รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)
            </label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" />
              <input
                id="first-password"
                type={show ? "text" : "password"}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
              <button type="button" className="auth-password-toggle" onClick={() => setShow(!show)} aria-label="แสดงรหัสผ่าน">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="first-password-confirm">
              ยืนยันรหัสผ่าน
            </label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" />
              <input
                id="first-password-confirm"
                type={show ? "text" : "password"}
                className="auth-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <button type="submit" className="auth-btn-primary" disabled={saving}>
            <KeyRound size={18} />
            {saving ? "กำลังบันทึก..." : "ตั้งรหัสผ่านและเข้าใช้งาน"}
          </button>
          <button type="button" className="auth-link-btn" onClick={() => void auth.logout()}>
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
