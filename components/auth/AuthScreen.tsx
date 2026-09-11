"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";

interface AuthScreenProps {
  auth: AuthState;
}

export function AuthScreen({ auth }: AuthScreenProps) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

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
        setError(res.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupUsername.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้ (Username)");
      return;
    }
    if (signupUsername.trim().length < 3) {
      setError("ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.signup({
        username: signupUsername.trim(),
        name: signupName.trim() || signupUsername.trim(),
        password: signupPassword,
      });
      if (!res.success) {
        setError(res.error || "สมัครสมาชิกไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setTab("login");
    setLoginUsername("admin");
    setLoginPassword("123456");
    setError(null);
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

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
          >
            <LogIn size={16} />
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "signup" ? "active" : ""}`}
            onClick={() => {
              setTab("signup");
              setError(null);
            }}
          >
            <UserPlus size={16} />
            สมัครสมาชิกใหม่
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {tab === "login" ? (
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
                  placeholder="เช่น admin"
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
                  placeholder="กรอกรหัสผ่านของคุณ"
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

            {/* Quick Demo Fill Helper */}
            <div
              className="auth-demo-badge"
              onClick={fillAdminCredentials}
              title="คลิกเพื่อกรอกข้อมูลผู้ดูแลระบบอัตโนมัติ"
            >
              <div className="auth-demo-title">
                <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                บัญชีเริ่มต้นสำหรับทดสอบ (Admin)
              </div>
              <div className="auth-demo-content">
                คลิกที่นี่: Username: <code>admin</code> / Password: <code>123456</code>
              </div>
            </div>
          </form>
        ) : (
          /* Sign Up Form */
          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-username">
                ชื่อผู้ใช้ (Username)*
              </label>
              <div className="auth-input-wrap">
                <User className="auth-input-icon" />
                <input
                  id="signup-username"
                  type="text"
                  className="auth-input"
                  placeholder="เช่น john_doe (ภาษาอังกฤษ/ตัวเลข)"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-name">
                ชื่อ-นามสกุล / ชื่อที่แสดง
              </label>
              <div className="auth-input-wrap">
                <User className="auth-input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  className="auth-input"
                  placeholder="เช่น สมชาย ใจดี"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-password">
                รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="ตั้งรหัสผ่านของคุณ"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-confirm-password">
                ยืนยันรหัสผ่านอีกครั้ง*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="กรอกรหัสผ่านเดิมอีกครั้ง"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              <UserPlus size={18} />
              {loading ? "กำลังลงทะเบียน..." : "สมัครสมาชิกและเข้าใช้งาน"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
