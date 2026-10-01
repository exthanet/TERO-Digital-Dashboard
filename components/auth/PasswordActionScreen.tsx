"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resetLinkSettings } from "@/lib/auth/users";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/auth/validation";
import { BRAND } from "@/lib/brand";

/** The parts of a Firebase email action link this page handles. */
export interface PasswordAction {
  oobCode: string;
  /** Came from an invitation (continue URL carries invited=1). */
  invited: boolean;
}

/**
 * Reads `?mode=resetPassword&oobCode=…` from the address bar. Firebase sends
 * people here when the email template's action URL is set to the dashboard.
 */
export function readPasswordAction(search: string): PasswordAction | null {
  const p = new URLSearchParams(search);
  const code = p.get("oobCode");
  if (p.get("mode") !== "resetPassword" || !code) return null;
  const continueUrl = p.get("continueUrl") || "";
  return { oobCode: code, invited: p.get("invited") === "1" || /[?&]invited=1\b/.test(continueUrl) };
}

const codeError = (e: unknown) => {
  const code = String((e as { code?: string })?.code || "");
  if (code.includes("expired")) return "ลิงก์นี้หมดอายุแล้ว";
  if (code.includes("invalid-action-code")) return "ลิงก์นี้ใช้ไปแล้ว หรือไม่ถูกต้อง";
  if (code.includes("user-disabled")) return "บัญชีนี้ถูกปิดการใช้งาน ติดต่อผู้ดูแลระบบ";
  if (code.includes("user-not-found")) return "ไม่พบบัญชีนี้ ติดต่อผู้ดูแลระบบ";
  if (code.includes("weak-password")) return `รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  if (code.includes("network")) return "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง";
  return "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
};

/** Set a password from an invitation or "ลืมรหัสผ่าน" link, then go to sign-in. */
export function PasswordActionScreen({ action, onDone }: { action: PasswordAction; onDone: (email: string) => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState<string | null>(null);

  useEffect(() => {
    verifyPasswordResetCode(auth, action.oobCode)
      .then(setEmail)
      .catch((e) => setLinkError(codeError(e)))
      .finally(() => setChecking(false));
  }, [action.oobCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("รหัสผ่านทั้ง 2 ช่องไม่ตรงกัน");
    setSaving(true);
    try {
      await confirmPasswordReset(auth, action.oobCode, password);
      onDone(email || "");
    } catch (err) {
      setError(codeError(err));
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setResent(null);
    const target = resendEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return setResent("กรอกอีเมลของคุณก่อน");
    try {
      await sendPasswordResetEmail(auth, target, resetLinkSettings(false));
    } catch {
      /* same answer either way: do not reveal whether the account exists */
    }
    setResent(`ถ้ามีบัญชีของ ${target} ระบบได้ส่งลิงก์ใหม่ไปทางอีเมลแล้ว (ตรวจกล่อง Junk ด้วย)`);
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
          <h1 className="auth-title">{action.invited ? "ยินดีต้อนรับ" : "ตั้งรหัสผ่านใหม่"}</h1>
          <p className="auth-subtitle">
            {action.invited
              ? `คุณได้รับสิทธิ์เข้าใช้ ${BRAND.product} ตั้งรหัสผ่านเพื่อเริ่มใช้งาน`
              : `ตั้งรหัสผ่านใหม่สำหรับ ${BRAND.product}`}
          </p>
        </div>

        {checking && <p className="auth-subtitle">กำลังตรวจสอบลิงก์...</p>}

        {linkError && (
          <>
            <div className="auth-error">
              <AlertCircle size={18} />
              <span>{linkError} ขอลิงก์ใหม่ได้ด้านล่าง</span>
            </div>
            <div className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="resend-email">
                  อีเมลของคุณ
                </label>
                <div className="auth-input-wrap">
                  <Mail className="auth-input-icon" />
                  <input
                    id="resend-email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>
              </div>
              {resent && (
                <div className="auth-info">
                  <CheckCircle2 size={18} />
                  <span>{resent}</span>
                </div>
              )}
              <button type="button" className="auth-btn-primary" onClick={resend}>
                <Mail size={18} /> ส่งลิงก์ใหม่
              </button>
              <button type="button" className="auth-link-btn" onClick={() => onDone("")}>
                ไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </>
        )}

        {email && (
          <form className="auth-form" onSubmit={submit}>
            {error && (
              <div className="auth-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <div className="auth-field">
              <label className="auth-label">บัญชี</label>
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon" />
                <input className="auth-input" value={email} readOnly autoComplete="username" />
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="new-password">
                รหัสผ่านใหม่ (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร)
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="new-password"
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
              <label className="auth-label" htmlFor="confirm-password">
                ยืนยันรหัสผ่าน
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="confirm-password"
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
              {saving ? "กำลังบันทึก..." : "ตั้งรหัสผ่าน"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
