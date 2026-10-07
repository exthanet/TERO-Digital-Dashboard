"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthResult,
  ChangePasswordData,
  LoginCredentials,
  LoginEvent,
  NewUserData,
  User,
  UserRole,
} from "@/lib/auth/types";
import {
  changeOwnPassword,
  inviteUser,
  setFirstPassword,
  listLoginEvents,
  listUsers,
  sendResetEmail,
  signIn,
  signOutUser,
  logPermissionChange,
  updateUser,
  watchSession,
} from "@/lib/auth/users";
import type { PermOverrides } from "@/lib/auth/permissions";
import { authErrorMessage } from "@/lib/auth/validation";
import { LinkNeeded, linkMicrosoftWithPassword, signInWithMicrosoft } from "@/lib/auth/microsoft";
import type { AuthCredential } from "firebase/auth";

/** Microsoft sign-in found a password account with the same email: link it with the password once. */
export interface PendingLink {
  email: string;
  credential: AuthCredential;
}

function microsoftError(e: unknown): string {
  const code = (e as { code?: string }).code || "";
  if (code === "auth/not-company-account") return "ใช้ได้เฉพาะบัญชีบริษัท @terodigital.com";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/popup-blocked") return "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน กรุณาอนุญาต pop-up ของเว็บนี้แล้วลองใหม่";
  if (code === "auth/operation-not-allowed") return "ยังไม่ได้เปิดการล็อกอินด้วย Microsoft ในระบบ กรุณาติดต่อผู้ดูแลระบบ";
  return authErrorMessage(e, "เข้าสู่ระบบด้วย Microsoft ไม่สำเร็จ");
}
import { track } from "@/lib/loadingBar";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Why the session ended on its own (deactivated, no profile, ...). */
  notice: string | null;
  login: (creds: LoginCredentials) => Promise<AuthResult>;
  /** Company Microsoft account; `link` when a password account already has this email. */
  loginWithMicrosoft: () => Promise<AuthResult & { link?: PendingLink }>;
  linkMicrosoft: (link: PendingLink, password: string) => Promise<AuthResult>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  changePassword: (data: ChangePasswordData) => Promise<AuthResult>;
  // Admin only (enforced by firestore.rules).
  allUsers: User[];
  refreshUsers: () => Promise<void>;
  inviteUser: (data: NewUserData) => Promise<AuthResult>;
  setFirstPassword: (newPassword: string) => Promise<AuthResult>;
  setUserRole: (uid: string, role: UserRole) => Promise<AuthResult>;
  /** Single permissions on top of the role; undefined = the role's own. */
  setUserPerms: (uid: string, perms: PermOverrides | undefined) => Promise<AuthResult>;
  setUserActive: (uid: string, active: boolean) => Promise<AuthResult>;
  loadLoginEvents: (since: Date) => Promise<LoginEvent[]>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(
    () =>
      watchSession((next, reason) => {
        setUser(next);
        if (reason) setNotice(reason);
        if (next) setNotice(null);
        setIsLoading(false);
      }),
    [],
  );

  const refreshUsers = useCallback(async () => {
    setAllUsers(await track(listUsers()));
  }, []);

  const login = useCallback(async (creds: LoginCredentials): Promise<AuthResult> => {
    try {
      setNotice(null);
      await signIn(creds.email, creds.password);
      return { success: true };
    } catch (e) {
      return { success: false, error: authErrorMessage(e, "เข้าสู่ระบบไม่สำเร็จ") };
    }
  }, []);

  const loginWithMicrosoft = useCallback(async (): Promise<AuthResult & { link?: PendingLink }> => {
    try {
      setNotice(null);
      await signInWithMicrosoft();
      return { success: true };
    } catch (e) {
      if (e instanceof LinkNeeded) return { success: false, link: { email: e.email, credential: e.credential } };
      return { success: false, error: microsoftError(e) };
    }
  }, []);

  const linkMicrosoft = useCallback(async (link: PendingLink, password: string): Promise<AuthResult> => {
    try {
      await linkMicrosoftWithPassword(link.email, password, link.credential);
      return { success: true };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
      return { success: false, error: authErrorMessage(e, "ผูกบัญชี Microsoft ไม่สำเร็จ") };
    }
  }, []);

  const logout = useCallback(() => {
    setAllUsers([]);
    // No company data stays in this browser after signing out.
    void import("@/lib/dashboardCache").then((m) => m.clearDashboardBrowserCache()).catch(() => undefined);
    void signOutUser();
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      await sendResetEmail(email);
      return { success: true };
    } catch (e) {
      return { success: false, error: authErrorMessage(e, "ส่งอีเมลไม่สำเร็จ") };
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordData): Promise<AuthResult> => {
    try {
      await changeOwnPassword(data);
      return { success: true };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
      }
      return { success: false, error: authErrorMessage(e, "เปลี่ยนรหัสผ่านไม่สำเร็จ") };
    }
  }, []);

  const adminAction = useCallback(
    async (action: () => Promise<void>, fallback: string): Promise<AuthResult> => {
      try {
        await action();
        await refreshUsers();
        return { success: true };
      } catch (e) {
        return { success: false, error: authErrorMessage(e, fallback) };
      }
    },
    [refreshUsers],
  );

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    notice,
    login,
    loginWithMicrosoft,
    linkMicrosoft,
    logout,
    requestPasswordReset,
    changePassword,
    allUsers,
    refreshUsers,
    inviteUser: async (data) => {
      let password = "";
      const res = await adminAction(async () => {
        password = await inviteUser(data);
      }, "สร้างผู้ใช้ไม่สำเร็จ");
      return res.success ? { ...res, tempPassword: password } : res;
    },
    setFirstPassword: async (newPassword) => {
      try {
        await setFirstPassword(newPassword);
        return { success: true };
      } catch (e) {
        return { success: false, error: authErrorMessage(e, "ตั้งรหัสผ่านไม่สำเร็จ") };
      }
    },
    setUserRole: (uid, role) =>
      adminAction(async () => {
        const target = allUsers.find((u) => u.id === uid);
        // A new role starts from its own permissions.
        await updateUser(uid, { role, perms: null });
        if (target) void logPermissionChange(target, { role: target.role, perms: target.perms }, { role });
      }, "เปลี่ยนสิทธิ์ไม่สำเร็จ"),
    setUserPerms: (uid, perms) =>
      adminAction(async () => {
        const target = allUsers.find((u) => u.id === uid);
        await updateUser(uid, { perms: perms ?? null });
        if (target) void logPermissionChange(target, { role: target.role, perms: target.perms }, { role: target.role, perms: perms ?? {} });
      }, "เปลี่ยนสิทธิ์ไม่สำเร็จ"),
    setUserActive: (uid, active) =>
      adminAction(() => updateUser(uid, { active }), "เปลี่ยนสถานะบัญชีไม่สำเร็จ"),
    loadLoginEvents: listLoginEvents,
  };
}
