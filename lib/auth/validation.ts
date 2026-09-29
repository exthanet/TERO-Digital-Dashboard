// Pure helpers shared by the auth service and its tests (no Firebase imports).

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

/**
 * Throwaway password for a newly invited account. Nobody ever sees it: the
 * user sets their own password from the invite (password reset) email.
 */
export function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
