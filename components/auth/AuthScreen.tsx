"use client";

import React, { useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";

interface AuthScreenProps {
  auth: AuthState;
}

export function AuthScreen({ auth }: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginUsername.trim() || !loginPassword) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.login({
        username: loginUsername.trim(),
        password: loginPassword,
      });
      if (!res.success) {
        setError(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setLoading(false);
    }
  };

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
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-username">
              ชื่อผู้ใช้ (Username)
            </label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" />
              <input
                id="login-username"
                type="text"
                className="auth-input"
                placeholder="กรอกชื่อผู้ใช้"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
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
        </form>
      </div>
    </div>
  );
}
