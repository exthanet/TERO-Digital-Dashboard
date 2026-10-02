#!/usr/bin/env node
/**
 * One-time TikTok Login Kit authorisation for the dashboard's own TikTok app
 * (sandbox or live). The secret never leaves this machine: the browser only
 * carries the short-lived code back to the registered redirect URI, and this
 * script exchanges it here.
 *
 *   node scripts/tiktok-auth.mjs url        # print the link the account owner opens
 *   node scripts/tiktok-auth.mjs exchange   # turn the returned code into tokens
 *
 * .env.local: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET (in), TIKTOK_REDIRECT_URI (optional,
 * default https://digital-dashboard.terodigital.com/), TIKTOK_AUTH_REDIRECT (the full URL
 * from the address bar after approving), TIKTOK_REFRESH_TOKEN (out).
 * The state value is kept in output/tiktok-auth-state.txt (git-ignored) and checked.
 * Prints no secrets or tokens.
 */
import crypto from "node:crypto";
import fs from "node:fs";

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
} else {
  console.log("usage: node scripts/tiktok-auth.mjs url | exchange");
}
