"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Lock, X } from "lucide-react";
import type { AuthState } from "@/hooks/useAuth";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  auth: AuthState;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  auth,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError("กรุณากรอกรหัสผ่านปัจจุบัน");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (currentPassword === newPassword) {
      setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม");
      return;
    }

    setLoading(true);
    try {
      const res = await auth.changePassword({
        currentPassword,
        newPassword,
      });
      if (res.success) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 1500);
      } else {
        setError(res.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <div className="auth-modal-backdrop" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3 className="auth-modal-title">
            <KeyRound size={20} className="text-primary" />
            เปลี่ยนรหัสผ่าน (Change Password)
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
                <span>เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว</span>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="current-pw">
                รหัสผ่านปัจจุบัน*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="current-pw"
                  type="password"
                  className="auth-input"
                  placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="new-pw">
                รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="new-pw"
                  type="password"
                  className="auth-input"
                  placeholder="ตั้งรหัสผ่านใหม่"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="confirm-pw">
                ยืนยันรหัสผ่านใหม่อีกครั้ง*
              </label>
              <div className="auth-input-wrap">
                <Lock className="auth-input-icon" />
                <input
                  id="confirm-pw"
                  type="password"
                  className="auth-input"
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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
              disabled={loading || success}
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
