"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import type { AuthState, PendingLink } from "@/hooks/useAuth";
import { isValidEmail } from "@/lib/auth/validation";
import { BRAND } from "@/lib/brand";

interface AuthScreenProps {
  auth: AuthState;
  /** After setting a password: the account's email and a note to show. */
  initialEmail?: string;
  initialInfo?: string;
}

/** The four-square Microsoft logo (brand colours), for the sign-in button. */
function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function AuthScreen({ auth, initialEmail = "", initialInfo }: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialInfo || null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(initialEmail);
  const [loginPassword, setLoginPassword] = useState("");
  // Microsoft found an existing password account with the same email: link once with the password.
  const [link, setLink] = useState<PendingLink | null>(null);
  // Everyone signs in with Microsoft; the email form is for the few outside accounts, opened on request.
  // Already open when the page comes back with an email (after setting a password).
  const [showEmailForm, setShowPasswordForm] = useState(!!initialEmail);
  const [linkPassword, setLinkPassword] = useState("");

  const handleMicrosoft = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await auth.loginWithMicrosoft();
      if (res.link) {
        setLink(res.link);
        setLinkPassword("");
      } else if (!res.success && res.error) {
        setError(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || !linkPassword) return;
    setError(null);
    setLoading(true);
    try {
      const res = await auth.linkMicrosoft(link, linkPassword);
      if (res.success) setLink(null);
      else setError(res.error || "ผูกบัญชีไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (!res.success) {
        setError(res.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!isValidEmail(loginEmail)) {
      setError("กรอกอีเมลของคุณในช่องด้านบนก่อน แล้วกด “ลืมรหัสผ่าน” อีกครั้ง");
      return;
    }
    setLoading(true);
    const res = await auth.requestPasswordReset(loginEmail);
    setLoading(false);
    if (res.success) {
      // Same wording whether or not the account exists.
      setInfo(`ถ้ามีบัญชีของ ${loginEmail.trim()} ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปทางอีเมลแล้ว (ตรวจกล่อง Junk ด้วย)`);
    } else {
      setError(res.error || "ส่งอีเมลไม่สำเร็จ");
    }
  };

  const message = error || auth.notice;

  return (
    <div className="auth-wrapper">
      <div className="auth-ambient-glow" />
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="live-dot" />
            {BRAND.company}
          </div>
          <h1 className="auth-title">{BRAND.productShort.toUpperCase()}</h1>
          <p className="auth-subtitle">
            ระบบรายงานวิเคราะห์ Performance & Rating สำหรับผู้บริหารและทีมงาน
          </p>
        </div>

        {/* Error Alert */}
        {message && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{message}</span>
          </div>
        )}
        {info && (
          <div className="auth-info">
            <CheckCircle2 size={18} />
            <span>{info}</span>
          </div>
        )}

        {link ? (
          <form className="auth-form" onSubmit={handleLink}>
            <p className="auth-link-note">
              อีเมล <b>{link.email}</b> มีบัญชีที่ใช้รหัสผ่านอยู่แล้ว · ใส่รหัสผ่านเดิม <b>ครั้งเดียว</b> เพื่อผูกกับบัญชี Microsoft
              (สิทธิ์และข้อมูลเดิมยังอยู่ ครั้งต่อไปกดปุ่ม Microsoft ได้เลย)
            </p>
            <div className="auth-field">
              <label className="auth-label" htmlFor="link-password">
                รหัสผ่านเดิม
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="link-password"
                  type="password"
                  className="auth-input"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
            </div>
            <button type="submit" className="auth-btn-primary" disabled={loading}>
              <LogIn size={18} />
              {loading ? "กำลังผูกบัญชี..." : "ผูกบัญชีและเข้าสู่ระบบ"}
            </button>
            <button type="button" className="auth-link-btn" onClick={() => setLink(null)} disabled={loading}>
              ยกเลิก
            </button>
          </form>
        ) : (
          <>
            <button type="button" className="auth-btn-microsoft" onClick={handleMicrosoft} disabled={loading}>
              <MicrosoftLogo />
              เข้าสู่ระบบด้วย Microsoft
            </button>
            <p className="auth-ms-note">สำหรับพนักงาน (บัญชี @terodigital.com)</p>
            {showEmailForm ? (
              <div className="auth-divider">
                <span>หรือใช้อีเมลและรหัสผ่าน</span>
              </div>
            ) : (
              <button type="button" className="auth-link-btn auth-other-login" onClick={() => setShowPasswordForm(true)}>
                เข้าสู่ระบบด้วยอีเมล
              </button>
            )}
          </>
        )}

        {/* Login Form (outside accounts only) */}
        {!link && showEmailForm && (
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              อีเมล (Email)
            </label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input
                id="login-email"
                type="email"
                inputMode="email"
                className="auth-input"
                placeholder="name@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              รหัสผ่าน (Password)
            </label>
            <div className="auth-input-wrap">
              <Lock className="auth-input-icon" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="กรอกรหัสผ่าน"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            <LogIn size={18} />
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ (Sign In)"}
          </button>
          <button
            type="button"
            className="auth-link-btn"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            ลืมรหัสผ่าน?
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
