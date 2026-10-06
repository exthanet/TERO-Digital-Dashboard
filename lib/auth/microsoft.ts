// Sign-in with the company Microsoft account (Entra ID) through Firebase Auth.
// Only @terodigital.com: the Microsoft page is limited to the company tenant,
// and the first sign-in creates a viewer profile (users/{uid}) that admins can
// promote or deactivate. firestore.rules enforces the same: a profile can be
// created by its own Microsoft account only, as an active viewer, with a
// company email. Existing password accounts keep working as before.
import {
  OAuthProvider,
  deleteUser,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type AuthCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizeEmail } from "./validation";

export const COMPANY_DOMAIN = "terodigital.com";
/** Entra ID directory (tenant) "Tero Entertainment": only its accounts can sign in. An id, not a secret. */
export const MS_TENANT_ID = "85a5eb4d-6fe5-41c9-b00b-b65edac8020c";

export const isCompanyEmail = (email: string | null | undefined) => normalizeEmail(String(email || "")).endsWith(`@${COMPANY_DOMAIN}`);

/** Signed in through Microsoft (alone or linked to a password). */
export const viaMicrosoft = (u: FirebaseUser) => u.providerData.some((p) => p.providerId === "microsoft.com");

function provider() {
  const p = new OAuthProvider("microsoft.com");
  // The company tenant and the account picker every time.
  p.setCustomParameters({ tenant: MS_TENANT_ID, prompt: "select_account" });
  return p;
}

/** The password account already holds this email: sign in with the password once to link Microsoft to it. */
export class LinkNeeded extends Error {
  constructor(
    public email: string,
    public credential: AuthCredential,
  ) {
    super("link-needed");
  }
}

const recordLogin = (u: FirebaseUser) =>
  void addDoc(collection(db, "loginEvents"), {
    uid: u.uid,
    email: u.email ?? "",
    name: u.displayName ?? "",
    provider: "microsoft",
    at: serverTimestamp(),
  }).catch(() => undefined);

export async function signInWithMicrosoft(): Promise<void> {
  try {
    const cred = await signInWithPopup(auth, provider());
    if (!isCompanyEmail(cred.user.email)) {
      // Not a company account: remove the Auth account it just made, and leave.
      await deleteUser(cred.user).catch(() => signOut(auth));
      throw Object.assign(new Error("not company"), { code: "auth/not-company-account" });
    }
    recordLogin(cred.user);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/account-exists-with-different-credential") {
      const credential = OAuthProvider.credentialFromError(e as Parameters<typeof OAuthProvider.credentialFromError>[0]);
      const email = String((e as { customData?: { email?: string } }).customData?.email || "");
      if (credential && email) throw new LinkNeeded(email, credential);
    }
    throw e;
  }
}

/** Sign in with the existing password, then attach the Microsoft sign-in to the same account (same profile and role). */
export async function linkMicrosoftWithPassword(email: string, password: string, credential: AuthCredential): Promise<void> {
  const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
  await linkWithCredential(cred.user, credential);
  recordLogin(cred.user);
}

/** First Microsoft sign-in of a company account: its own viewer profile. */
export function createCompanyProfile(u: FirebaseUser): Promise<void> {
  const email = normalizeEmail(u.email || "");
  return setDoc(doc(db, "users", u.uid), {
    email,
    name: (u.displayName || "").trim() || email,
    role: "viewer",
    active: true,
    createdAt: serverTimestamp(),
    mustChangePassword: false,
  });
}
