// New dashboard accounts for the daily sync's Telegram message
// (scripts/notify-telegram.mjs --sync, lib/integrations/newUsers.ts).
//
//   node scripts/new-user-alert.mjs --dry-run  how many would be announced; sends and saves nothing
//
// The last announced account time is kept in syncConfig/userAlerts {since}. The
// first run only sets it (accounts that already exist are not announced). When
// Telegram fails, `since` stays, so the next day's message has them.
import fs from "node:fs";
import { Firestore, decodeFields, docId, encodeFields, getAccessToken } from "../lib/integrations/firestoreRest.ts";
import { newUsersSince } from "../lib/integrations/newUsers.ts";

const STATE = "syncConfig/userAlerts";

/** Firestore through the service account; null when there is none. */
export async function connectDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) return null;
  const sa = JSON.parse(raw);
  return new Firestore(sa.project_id, await getAccessToken(sa));
}

/** Accounts created since the last message, oldest first; [] on the first run (which only sets the start unless dryRun). */
export async function pendingNewUsers(db, { dryRun = false } = {}) {
  const state = await db.get(STATE);
  const since = state ? String(decodeFields(state.fields || {}).since || "") : "";
  if (!since) {
    const now = new Date().toISOString();
    if (!dryRun) await db.set(STATE, encodeFields({ since: now, updatedAt: now }));
    console.log(`New users: first run, starting from ${now}${dryRun ? " (dry run, not saved)" : ""}`);
    return [];
  }
  const users = (await db.listRaw("users")).map((d) => ({ uid: docId(d.name), ...decodeFields(d.fields || {}) }));
  const fresh = newUsersSince(users, since);
  console.log(`New users: ${fresh.length} since ${since} (of ${users.length} accounts)`);
  return fresh;
}

/** After the message was sent: the next one starts after the newest account in it. */
export async function markAnnounced(db, fresh) {
  if (!fresh.length) return;
  await db.set(STATE, encodeFields({ since: String(fresh[fresh.length - 1].createdAt), updatedAt: new Date().toISOString() }));
}

if (process.argv[1]?.endsWith("new-user-alert.mjs")) {
  connectDb()
    .then((db) => (db ? pendingNewUsers(db, { dryRun: true }) : console.log("New users: no service account")))
    .catch((e) => console.log(`New users: not checked (${e.message})`));
}
