"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthSession,
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  User,
} from "@/lib/auth/types";
import {
  authenticateUser,
  ensureDefaultAdmin,
  getAllUsers,
  getStoredSession,
  registerNewUser,
  removeSession,
  saveSession,
  updateUserPassword,
} from "@/lib/auth/storage";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  allUsers: User[];
  login: (creds: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signup: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    data: ChangePasswordData,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  adminCreateUser: (
    data: RegisterData,
  ) => Promise<{ success: boolean; error?: string }>;
  refreshUsers: () => void;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshUsers = useCallback(() => {
    setAllUsers(getAllUsers());
  }, []);

  // Initialize session on mount
  useEffect(() => {
    async function init() {
      await ensureDefaultAdmin();
      const existing = getStoredSession();
      if (existing) {
        setSession(existing);
      }
      refreshUsers();
      setIsLoading(false);
    }
    init();
  }, [refreshUsers]);

  const login = useCallback(
    async (creds: LoginCredentials) => {
      const result = await authenticateUser(creds);
      if (!result) {
        return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }
      const newSession = saveSession(result.user, result.token);
      setSession(newSession);
      refreshUsers();
      return { success: true };
    },
    [refreshUsers],
  );

  const signup = useCallback(
    async (data: RegisterData) => {
      const res = await registerNewUser(data);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || "สมัครสมาชิกไม่สำเร็จ" };
      }
      // Auto-login after sign-up
      const newSession = saveSession(res.user, `token_${res.user.id}_${Date.now()}`);
      setSession(newSession);
      refreshUsers();
      return { success: true };
    },
    [refreshUsers],
  );

  const adminCreateUser = useCallback(
    async (data: RegisterData) => {
      const res = await registerNewUser(data);
      if (!res.success) {
        return { success: false, error: res.error || "สร้างผู้ใช้ไม่สำเร็จ" };
      }
      refreshUsers();
      return { success: true };
    },
    [refreshUsers],
  );

  const changePassword = useCallback(
    async (data: ChangePasswordData) => {
      if (!session?.user) {
        return { success: false, error: "กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน" };
      }
      const res = await updateUserPassword(session.user.id, data);
      return res;
    },
    [session?.user],
  );

  const logout = useCallback(() => {
    removeSession();
    setSession(null);
  }, []);

  return {
    user: session?.user ?? null,
    isAuthenticated: !!session?.user,
    isLoading,
    allUsers,
    login,
    signup,
    changePassword,
    logout,
    adminCreateUser,
    refreshUsers,
  };
}
