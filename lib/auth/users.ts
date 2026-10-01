// Firebase-backed accounts. Passwords live in Firebase Auth; each account's
// profile and role live in Firestore at users/{uid}. firestore.rules decides
// who may read or change what, so the checks here are for the UI only.
import { deleteApp, initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseConfig, useFirebaseEmulator } from "@/lib/firebase";
import type {
  ChangePasswordData,
  LoginEvent,
  NewUserData,
  User,
  UserRole,
} from "./types";
import { normalizeEmail, tempPassword } from "./validation";

const usersCol = collection(db, "users");
const loginEventsCol = collection(db, "loginEvents");

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

function toUser(id: string, data: DocumentData): User {
  return {
    id,
    email: String(data.email ?? ""),
    name: String(data.name ?? data.email ?? ""),
    role: data.role === "admin" ? "admin" : "viewer",
    active: data.active === true,
    createdAt: toIso(data.createdAt),
    mustChangePassword: data.mustChangePassword === true,
  };
}

/**
 * Follows the signed-in account and its profile. `onChange(null)` means signed
 * out. A missing or deactivated profile signs the session out, with a reason.
 */
export function watchSession(
  onChange: (user: User | null, reason?: string) => void,
): () => void {
  let stopProfile: (() => void) | undefined;
  const stopAuth = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
    stopProfile?.();
    stopProfile = undefined;
    if (!fbUser) {
      onChange(null);
      return;
    }
    stopProfile = onSnapshot(
      doc(db, "users", fbUser.uid),
      (snap) => {
        const profile = snap.exists() ? toUser(snap.id, snap.data()) : null;
        if (!profile || !profile.active) {
          void signOut(auth);
          onChange(
            null,
            profile ? "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" : "ไม่พบสิทธิ์ใช้งานของบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบ",
          );
          return;
        }
        onChange(profile);
      },
      () => {
        void signOut(auth);
        onChange(null, "ไม่สามารถตรวจสอบสิทธิ์ของบัญชีนี้ได้");
      },
    );
  });
  return () => {
    stopProfile?.();
    stopAuth();
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
  // Fire and forget: if watchSession signs the account out (deactivated or no
  // profile) the pending write can stay unresolved, which left the login
  // button spinning when this was awaited.
  void addDoc(loginEventsCol, {
    uid: cred.user.uid,
    email: cred.user.email ?? normalizeEmail(email),
    name: cred.user.displayName ?? "",
    at: serverTimestamp(),
  }).catch(() => undefined);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

/**
 * Where the set-password link leads back to (Firebase "continue URL"). The
 * dashboard handles the link itself when the email template's action URL is
 * set to the dashboard; invited=1 switches the page to the welcome wording.
 * The domain must be in Firebase Auth → Authorized domains.
 */
export function resetLinkSettings(invited: boolean) {
  const origin = typeof window === "undefined" ? "https://digital-dashboard.terodigital.com" : window.location.origin;
  return { url: `${origin}/${invited ? "?invited=1" : ""}` };
}

export function sendResetEmail(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, normalizeEmail(email), resetLinkSettings(false));
}

export async function changeOwnPassword(data: ChangePasswordData): Promise<void> {
  const current = auth.currentUser;
  if (!current?.email) throw Object.assign(new Error("not signed in"), { code: "auth/requires-recent-login" });
  await reauthenticateWithCredential(
    current,
    EmailAuthProvider.credential(current.email, data.currentPassword),
  );
  await updatePassword(current, data.newPassword);
}

/**
 * Creates the Auth account on a separate Firebase app instance so the admin
 * stays signed in, with a temporary password the admin passes on; the
 * profile makes the person set their own password at the first sign-in.
 * Returns the temporary password.
 */
export async function inviteUser(data: NewUserData): Promise<string> {
  const password = tempPassword();
  const email = normalizeEmail(data.email);
  const secondary = initializeApp(firebaseConfig, `invite-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    if (useFirebaseEmulator) {
      connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      name: data.name.trim() || email,
      role: data.role,
      active: true,
      createdAt: serverTimestamp(),
      mustChangePassword: true,
    });
  } finally {
    await deleteApp(secondary);
  }
  return password;
}

/** First sign-in with a temporary password: set one's own, then clear the flag. */
export async function setFirstPassword(newPassword: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw Object.assign(new Error("not signed in"), { code: "auth/requires-recent-login" });
  await updatePassword(current, newPassword);
  await updateDoc(doc(db, "users", current.uid), { mustChangePassword: false });
}

export async function listUsers(): Promise<User[]> {
  const snap = await getDocs(usersCol);
  return snap.docs
    .map((d) => toUser(d.id, d.data()))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function updateUser(
  uid: string,
  changes: Partial<{ role: UserRole; active: boolean; name: string }>,
): Promise<void> {
  return updateDoc(doc(db, "users", uid), changes);
}

/** Login events since `since` (inclusive), newest first. */
export async function listLoginEvents(since: Date): Promise<LoginEvent[]> {
  const snap = await getDocs(
    query(loginEventsCol, where("at", ">=", Timestamp.fromDate(since)), orderBy("at", "desc")),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: String(data.uid ?? ""),
      email: String(data.email ?? ""),
      name: String(data.name ?? ""),
      at: toIso(data.at),
    };
  });
}
