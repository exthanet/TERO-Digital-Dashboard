// Pure helpers shared by the auth service and its tests (no Firebase imports).
import { BRAND } from "../brand.ts";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  }
  return null;
}

// No look-alike characters (0/O, 1/l/I), so it can be read out or retyped.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Temporary password for a new account, e.g. "Xk7m-Pq4r-Tz9d". The admin sends
 * it to the person, who must set their own password at the first sign-in.
 */
export function tempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Text the admin copies and sends (LINE, email) to a newly invited person. */
export function inviteMessage(name: string, email: string, password: string, url: string): string {
  return [
    `สวัสดีครับ/ค่ะ ${name || email}`,
    `คุณได้รับสิทธิ์เข้าใช้ ${BRAND.product}`,
    `เข้าระบบ: ${url}`,
    `อีเมล: ${email}`,
    `รหัสผ่านชั่วคราว: ${password}`,
    "เข้าระบบครั้งแรก ระบบจะให้ตั้งรหัสผ่านใหม่ของคุณเอง",
  ].join("\n");
}

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/user-disabled": "บัญชีนี้ถูกปิดการใช้งาน",
  "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่",
  "auth/email-already-in-use": "อีเมลนี้มีบัญชีอยู่แล้ว",
  "auth/weak-password": `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
  "auth/requires-recent-login": "กรุณาออกจากระบบแล้วเข้าใหม่ก่อนทำรายการนี้",
  "auth/network-request-failed": "เชื่อมต่อเครือข่ายไม่ได้ กรุณาลองใหม่",
  "permission-denied": "ไม่มีสิทธิ์ทำรายการนี้",
};

export function authErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  return (code && FIREBASE_ERRORS[code]) || fallback;
}
