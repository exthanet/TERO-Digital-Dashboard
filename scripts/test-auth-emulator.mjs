#!/usr/bin/env node
/**
 * End-to-end check of accounts + firestore.rules against the local emulators.
 * Never touches production.
 *
 *   firebase emulators:exec --only auth,firestore "node scripts/test-auth-emulator.mjs"
 *
 * Flow: seed an admin → admin invites a viewer (temporary password) → viewer
 * signs in and sets their own password → viewer logs in → rules allow/deny the right things →
 * admin deactivates the viewer → viewer loses access.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const PROJECT = "entertainment-dashboard-733e5";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
process.env.NEXT_PUBLIC_FIREBASE_EMULATOR = "true";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  appType: "custom",
  root,
  logLevel: "error",
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

const users = await vite.ssrLoadModule("/lib/auth/users.ts");
const { auth, db } = await vite.ssrLoadModule("/lib/firebase.ts");
const fs = await import("firebase/firestore");

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✖ ${name}\n      ${e?.message || e}`);
  }
}
const denied = async (promise) => {
  await assert.rejects(promise, (e) => e?.code === "permission-denied");
};

async function reset() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
}

/** Admin bootstrap, done in the Firebase Console in production. */
async function seedAdmin(email, password) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const { localId } = await res.json();
  // "Bearer owner" bypasses rules on the emulator, like the Console does.
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/users?documentId=${localId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({
      fields: {
        email: { stringValue: email },
        name: { stringValue: "Administrator" },
        role: { stringValue: "admin" },
        active: { booleanValue: true },
      },
    }),
  });
  await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/masterData?documentId=chunk_000`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ fields: { rowCount: { integerValue: "0" } } }),
  });
  return localId;
}

/** What the user does when they click the link in the invite email. */
const ADMIN = "admin@example.com";
const VIEWER = "exec@gmail.com";
const master = fs.doc(db, "masterData", "chunk_000");

await reset();
const adminUid = await seedAdmin(ADMIN, "admin-pass-123");
console.log("accounts + rules (emulator)");

await check("signed-out visitors cannot read dashboard data", () => denied(fs.getDoc(master)));

await users.signIn(ADMIN, "admin-pass-123");
await check("admin reads dashboard data", async () => {
  await fs.getDoc(master);
});
let tempPassword = "";
await check("admin invites a viewer with any email domain and gets a temporary password", async () => {
  tempPassword = await users.inviteUser({ email: VIEWER, name: "ผู้บริหาร", role: "viewer" });
  assert.match(tempPassword, /^\w{4}-\w{4}-\w{4}$/);
  assert.equal(auth.currentUser?.email, ADMIN, "admin was signed out by the invite");
  const list = await users.listUsers();
  assert.deepEqual(
    list.map((u) => [u.email, u.role, u.active]),
    [[ADMIN, "admin", true], [VIEWER, "viewer", true]],
  );
});
await check("inviting the same email twice is refused", () =>
  assert.rejects(users.inviteUser({ email: VIEWER, name: "", role: "viewer" }), (e) => e?.code === "auth/email-already-in-use"),
);
await check("admin cannot demote or deactivate themselves", async () => {
  await denied(users.updateUser(adminUid, { role: "viewer" }));
  await denied(users.updateUser(adminUid, { active: false }));
});
await check("admin writes dashboard data", () => fs.setDoc(master, { rowCount: 1 }));
await users.signOutUser();

await check("viewer signs in with the temporary password and must set their own", async () => {
  await users.signIn(VIEWER, tempPassword);
  const me = await fs.getDoc(fs.doc(db, "users", auth.currentUser.uid));
  assert.equal(me.data()?.mustChangePassword, true);
});
await check("while clearing the flag a viewer cannot change anything else, nor set it back", async () => {
  const ref = fs.doc(db, "users", auth.currentUser.uid);
  await denied(fs.updateDoc(ref, { mustChangePassword: false, role: "admin" }));
  await denied(fs.updateDoc(ref, { mustChangePassword: true }));
});
await check("viewer sets their own password, the flag clears, and the new password works", async () => {
  await users.setFirstPassword("viewer-pass-123");
  const me = await fs.getDoc(fs.doc(db, "users", auth.currentUser.uid));
  assert.equal(me.data()?.mustChangePassword, false);
  await users.signOutUser();
  await assert.rejects(users.signIn(VIEWER, tempPassword));
  await users.signIn(VIEWER, "viewer-pass-123");
  assert.equal(auth.currentUser?.email, VIEWER);
});
const viewerUid = auth.currentUser?.uid;
await check("viewer reads dashboard data and own profile", async () => {
  await fs.getDoc(master);
  const me = await fs.getDoc(fs.doc(db, "users", viewerUid));
  assert.equal(me.data()?.role, "viewer");
});
await check("viewer cannot write data, list users, promote self or read login log", async () => {
  await denied(fs.setDoc(master, { rowCount: 2 }));
  await denied(users.listUsers());
  await denied(users.updateUser(viewerUid, { role: "admin" }));
  await denied(users.listLoginEvents(new Date(0)));
});
await check("viewer cannot forge a login event for someone else", () =>
  denied(fs.addDoc(fs.collection(db, "loginEvents"), { uid: adminUid, email: ADMIN, name: "", at: fs.serverTimestamp() })),
);
await check("viewer changes own password (needs the current one)", async () => {
  await assert.rejects(users.changeOwnPassword({ currentPassword: "wrong-pass", newPassword: "viewer-pass-456" }));
  await users.changeOwnPassword({ currentPassword: "viewer-pass-123", newPassword: "viewer-pass-456" });
});
await users.signOutUser();

await users.signIn(ADMIN, "admin-pass-123");
await check("admin sees this month's logins for both accounts", async () => {
  const events = await users.listLoginEvents(new Date(Date.now() - 86400000));
  assert.deepEqual([...new Set(events.map((e) => e.email))].sort(), [ADMIN, VIEWER].sort());
});
await check("admin deactivates the viewer", () => users.updateUser(viewerUid, { active: false }));
await users.signOutUser();

await check("deactivated viewer can sign in to Auth but reads nothing", async () => {
  await users.signIn(VIEWER, "viewer-pass-456");
  await denied(fs.getDoc(master));
});
await check("watchSession signs a deactivated account out with a reason", async () => {
  const reason = await new Promise((resolve) => {
    const stop = users.watchSession((user, why) => {
      if (!user && why) {
        stop();
        resolve(why);
      }
    });
  });
  assert.match(reason, /ปิดการใช้งาน/);
  assert.equal(auth.currentUser, null);
});

await vite.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
