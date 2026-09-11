import type {
  AuthSession,
  ChangePasswordData,
  LoginCredentials,
  RegisterData,
  User,
  UserRecord,
} from "./types";

const USERS_STORAGE_KEY = "tero_dashboard_users_v1";
const SESSION_STORAGE_KEY = "tero_dashboard_session_v1";

// SHA-256 hash helper with fallback
async function hashPassword(password: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password + "_tero_salt_2026");
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback if subtle crypto fails
    }
  }
  // Simple fallback encoding
  let hash = 0;
  const str = password + "_tero_salt_2026";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

// Ensure default admin user exists
export async function ensureDefaultAdmin(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const users: UserRecord[] = raw ? JSON.parse(raw) : [];
    const hasAdmin = users.some(
      (u) => u.username.toLowerCase() === "admin",
    );

    if (!hasAdmin) {
      const adminHash = await hashPassword("123456");
      const defaultAdmin: UserRecord = {
        id: "usr_admin_001",
        username: "admin",
        name: "Administrator",
        role: "admin",
        passwordHash: adminHash,
        createdAt: new Date().toISOString(),
      };
      users.unshift(defaultAdmin);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  } catch (e) {
    console.error("Failed to initialize user storage", e);
  }
}

export function getAllUsers(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const records: UserRecord[] = JSON.parse(raw);
    return records.map(({ passwordHash: _, ...user }) => user);
  } catch {
    return [];
  }
}

export async function authenticateUser(
  creds: LoginCredentials,
): Promise<{ user: User; token: string } | null> {
  if (typeof window === "undefined") return null;
  await ensureDefaultAdmin();

  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return null;
  const records: UserRecord[] = JSON.parse(raw);

  const cleanUsername = creds.username.trim().toLowerCase();
  const record = records.find(
    (u) => u.username.toLowerCase() === cleanUsername,
  );
  if (!record) return null;

  const inputHash = await hashPassword(creds.password);
  if (record.passwordHash !== inputHash) {
    return null;
  }

  const { passwordHash: _, ...user } = record;
  const token = `token_${user.id}_${Date.now()}`;
  return { user, token };
}

export async function registerNewUser(
  data: RegisterData,
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window is undefined" };
  }
  await ensureDefaultAdmin();

  const cleanUsername = data.username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return { success: false, error: "ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 3 ตัวอักษร" };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return { success: false, error: "ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลขเท่านั้น" };
  }
  if (data.password.length < 6) {
    return { success: false, error: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" };
  }

  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  const records: UserRecord[] = raw ? JSON.parse(raw) : [];

  if (records.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return { success: false, error: `ชื่อผู้ใช้ "${data.username}" มีอยู่ในระบบแล้ว` };
  }

  const passwordHash = await hashPassword(data.password);
  const newUserRecord: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    username: cleanUsername,
    name: data.name.trim() || cleanUsername,
    role: data.role || "viewer",
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  records.push(newUserRecord);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(records));

  const { passwordHash: _, ...user } = newUserRecord;
  return { success: true, user };
}

export async function updateUserPassword(
  userId: string,
  data: ChangePasswordData,
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined") return { success: false, error: "Window is undefined" };

  if (data.newPassword.length < 6) {
    return { success: false, error: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" };
  }

  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return { success: false, error: "ไม่พบข้อมูลผู้ใช้ในระบบ" };
  const records: UserRecord[] = JSON.parse(raw);

  const idx = records.findIndex((u) => u.id === userId);
  if (idx === -1) return { success: false, error: "ไม่พบผู้ใช้นี้ในระบบ" };

  const currentHash = await hashPassword(data.currentPassword);
  if (records[idx].passwordHash !== currentHash) {
    return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  }

  records[idx].passwordHash = await hashPassword(data.newPassword);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(records));

  return { success: true };
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    return session;
  } catch {
    return null;
  }
}

export function saveSession(user: User, token: string): AuthSession {
  const session: AuthSession = {
    user,
    token,
    loginAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function removeSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
