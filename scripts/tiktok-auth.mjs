#!/usr/bin/env node
/**
 * One-time TikTok Login Kit authorisation for the dashboard's own TikTok app
 * (sandbox or live). The secret never leaves this machine: the browser only
 * carries the short-lived code back to the registered redirect URI, and this
 * script exchanges it here.
 *
 *   node scripts/tiktok-auth.mjs url        # print the link the account owner opens
 *   node scripts/tiktok-auth.mjs exchange   # turn the returned code into tokens
 *   node scripts/tiktok-auth.mjs save --brand="TERO Digital"
 *       # hand the account to the daily sync: store its refresh token in Firestore
 *       # syncSecrets/tiktok_* (no client can read it) and clear it from .env.local.
 *       # --brand is the Metricool brand label whose TikTok this account replaces.
 *       # FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 targets the emulator.
 *
 * .env.local: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET (in), TIKTOK_REDIRECT_URI (optional,
 * default https://digital-dashboard.terodigital.com/), TIKTOK_AUTH_REDIRECT (the full URL
 * from the address bar after approving), TIKTOK_REFRESH_TOKEN (out).
 * The state value is kept in output/tiktok-auth-state.txt (git-ignored) and checked.
 * Prints no secrets or tokens.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { Firestore, getAccessToken } from "../lib/integrations/firestoreRest.ts";
import { loadAccounts, refreshAccessToken, saveAccount } from "../lib/integrations/tiktokApi.ts";

const ENV_FILE = ".env.local";
const STATE_FILE = "output/tiktok-auth-state.txt";
const SCOPES = "user.info.basic,video.list";

for (const line of fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const redirectUri = process.env.TIKTOK_REDIRECT_URI || "https://digital-dashboard.terodigital.com/";

function saveEnv(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  fs.writeFileSync(ENV_FILE, re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, "\n")}${key}=${value}\n`);
}

const command = process.argv[2];
if (!process.env.TIKTOK_CLIENT_KEY) throw new Error(`TIKTOK_CLIENT_KEY missing in ${ENV_FILE}`);

if (command === "url") {
  const state = crypto.randomBytes(16).toString("hex");
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(STATE_FILE, state);
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.search = new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, scope: SCOPES, response_type: "code", redirect_uri: redirectUri, state }).toString();
  console.log(url.toString());
} else if (command === "exchange") {
  if (!process.env.TIKTOK_CLIENT_SECRET) throw new Error(`TIKTOK_CLIENT_SECRET missing in ${ENV_FILE}`);
  const back = new URL(process.env.TIKTOK_AUTH_REDIRECT || "about:blank");
  const code = back.searchParams.get("code");
  const state = back.searchParams.get("state");
  if (back.searchParams.get("error")) throw new Error(`TikTok refused: ${back.searchParams.get("error")} ${back.searchParams.get("error_description") || ""}`);
  if (!code) throw new Error(`no code in TIKTOK_AUTH_REDIRECT (paste the whole address-bar URL after approving)`);
  const expected = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, "utf8").trim() : "";
  if (!expected || state !== expected) throw new Error("state does not match the link this script made: run `url` again and approve with the new link");
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const body = await res.json();
  // The code is single-use: drop it either way.
  saveEnv("TIKTOK_AUTH_REDIRECT", "");
  fs.rmSync(STATE_FILE, { force: true });
  if (!res.ok || !body.refresh_token) throw new Error(`exchange failed: ${body.error || res.status} ${body.error_description || ""}`.trim());
  saveEnv("TIKTOK_REFRESH_TOKEN", body.refresh_token);
  console.log(`authorised · scope ${body.scope} · refresh token saved to ${ENV_FILE} (valid ${Math.round(body.refresh_expires_in / 86400)} days)`);
} else if (command === "save") {
  const brand = (process.argv.find((a) => a.startsWith("--brand=")) || "").slice(8).replace(/^["']|["']$/g, "");
  const brands = JSON.parse(fs.readFileSync("config/metricool-brands.json", "utf8")).map((b) => b.label);
  if (!brands.includes(brand)) throw new Error(`--brand must be one of: ${brands.join(", ")}`);
  if (!process.env.TIKTOK_REFRESH_TOKEN) throw new Error(`TIKTOK_REFRESH_TOKEN missing in ${ENV_FILE}: run url + exchange first`);
  const token = await refreshAccessToken(process.env.TIKTOK_CLIENT_KEY, process.env.TIKTOK_CLIENT_SECRET, process.env.TIKTOK_REFRESH_TOKEN);
  const info = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", { headers: { Authorization: `Bearer ${token.accessToken}` } }).then((r) => r.json());
  const openId = info.data?.user?.open_id || token.openId;
  const displayName = info.data?.user?.display_name || "";
  if (!openId) throw new Error("TikTok did not return the account id");

  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const projectId = JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const sa = emulator ? null : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  const db = new Firestore(projectId, await getAccessToken(sa));
  const existing = (await loadAccounts(db)).find((a) => a.openId === openId);
  const other = (await loadAccounts(db)).find((a) => a.brand === brand && a.openId !== openId);
  if (other) throw new Error(`brand "${brand}" already has TikTok account ${other.displayName}: remove syncSecrets/${other.id} first`);
  const account = existing || { id: `tiktok_${crypto.createHash("sha256").update(openId).digest("hex").slice(0, 12)}`, baselineDone: false };
  Object.assign(account, { brand, openId, displayName, refreshToken: token.refreshToken, refreshExpiresAt: token.refreshExpiresAt });
  await saveAccount(db, account);
  // Production holds the only copy from now on; an emulator test keeps the local one.
  if (!emulator) saveEnv("TIKTOK_REFRESH_TOKEN", "");
  console.log(`saved: syncSecrets/${account.id} · ${displayName} → brand "${brand}" · ${emulator ? `emulator (refresh token kept in ${ENV_FILE})` : `PRODUCTION · refresh token cleared from ${ENV_FILE}`}`);
} else {
  console.log("usage: node scripts/tiktok-auth.mjs url | exchange | save --brand=<label>");
}
