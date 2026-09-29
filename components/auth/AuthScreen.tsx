"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";
import { isValidEmail } from "@/lib/auth/validation";

interface AuthScreenProps {
  auth: AuthState;
}

export function AuthScreen({ auth }: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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
            TERO DIGITAL
          </div>
          <h1 className="auth-title">ENTERTAINMENT DASHBOARD</h1>
          <p className="auth-subtitle">
            ระบบรายงานวิเคราะห์ Performance & Rating สำหรับผู้บริหาร
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

        {/* Login Form */}
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
      </div>
    </div>
  );
}
