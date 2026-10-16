// New dashboard accounts, added to the daily sync's Telegram message
// (scripts/notify-telegram.mjs → scripts/new-user-alert.mjs): a first Microsoft
// sign-in (its own viewer profile) or an account an admin created. Admins then
// set what the person may see.
//
// Relative imports only: tests run this file directly with Node.
import { bangkokTime } from "./telegram.ts";

export interface UserProfile {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
  createdAt?: string;
  mustChangePassword?: boolean;
}

export const DASHBOARD_URL = "https://digital-dashboard.terodigital.com";

/** Profiles created after `since` (ISO), oldest first. Profiles without createdAt are older than this alert: never new. */
export function newUsersSince(users: UserProfile[], since: string): UserProfile[] {
  return users
    .filter((u) => u.createdAt && u.createdAt > since)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** "admin สร้างบัญชีให้" for a temporary password, otherwise the person signed in with Microsoft. */
const how = (u: UserProfile) => (u.mustChangePassword ? "admin สร้างบัญชีให้" : "ล็อกอิน Microsoft ครั้งแรก");

export function newUsersMessage(users: UserProfile[]): string {
  const lines = users.map((u) => {
    const name = (u.name || "").trim();
    const who = name && name !== u.email ? `${name} (${u.email})` : u.email || u.uid;
    return `• ${who} · สิทธิ์ ${u.role || "-"} · ${how(u)} · ${bangkokTime(u.createdAt || "")}`;
  });
  return [`👤 ผู้ใช้ใหม่ ${users.length} คน ใน TERO Media Insights`, ...lines, `ปรับสิทธิ์ได้ที่ จัดการผู้ใช้: ${DASHBOARD_URL}`].join("\n");
}
