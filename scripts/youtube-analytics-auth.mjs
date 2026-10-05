#!/usr/bin/env node
/**
 * One-time YouTube Analytics authorisation (Google OAuth, "Desktop app" client).
 * The person signs in on THIS machine; Google sends the code back to a local
 * 127.0.0.1 address and this script exchanges it here, so no code, secret or
 * token passes through chat.
 *
 * Channel mode (owner / Brand Account manager of one channel):
 *   node scripts/youtube-analytics-auth.mjs login            # → YT_REFRESH_TOKEN__<channelId> per channel picked on Google's chooser
 * Content owner (CMS) mode (a CMS user: every channel linked to that CMS):
 *   node scripts/youtube-analytics-auth.mjs login --cms=<contentOwnerId>   # → YT_CMS_OWNER_ID + YT_CMS_REFRESH_TOKEN
 * Read-only test (no writes anywhere):
 *   node scripts/youtube-analytics-auth.mjs check [--channel=UC…]   # CMS mode reads only the channels named (YT_CMS_CHANNELS, default terodigital)
 * Hand the CMS account to the daily sync (writes Firestore syncSecrets/youtube_cms, clears the token from .env.local):
 *   node scripts/youtube-analytics-auth.mjs save [--channels=UC…,UC…]   # default: terodigital only
 *
 * .env.local: YT_OAUTH_CLIENT_ID, YT_OAUTH_CLIENT_SECRET (in); refresh tokens (out).
 * Scopes are read-only. Prints no secrets or tokens.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";

const ENV_FILE = ".env.local";
const PORT = 8765;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth`;
const CHANNEL_SCOPES = ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"];
// A CMS user also needs youtubepartner; monetary is read-only revenue for the same channels.
const CMS_SCOPES = [...CHANNEL_SCOPES, "https://www.googleapis.com/auth/youtubepartner", "https://www.googleapis.com/auth/yt-analytics-monetary.readonly"];
/** terodigital, where the dashboard's YouTube clips are. */
const DEFAULT_CHANNELS = ["UCq2_AaNWBd0kxzR1HL2yhsw"];

for (const line of fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const clientId = process.env.YT_OAUTH_CLIENT_ID;
const clientSecret = process.env.YT_OAUTH_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error(`YT_OAUTH_CLIENT_ID / YT_OAUTH_CLIENT_SECRET missing in ${ENV_FILE}`);

function saveEnv(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  fs.writeFileSync(ENV_FILE, re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, "\n")}${key}=${value}\n`);
}

async function tokenRequest(params) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${body.error || res.status} ${body.error_description || ""}`);
  return body;
}

async function api(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${new URL(url).pathname}: ${body.error?.message || res.status}`);
  return body;
}

async function listChannels(accessToken) {
  const mine = await api("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", accessToken);
  return (mine.items || []).map((c) => ({ id: c.id, title: c.snippet?.title, videos: c.statistics?.videoCount }));
}

/** Top videos of the last 28 days (ending 2 days ago, when Analytics is complete). */
async function topVideos(accessToken, ids, filters) {
  const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const q = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  q.search = new URLSearchParams({
    ids,
    startDate: start,
    endDate: end,
    metrics: "views,averageViewDuration,averageViewPercentage,subscribersGained,shares",
    dimensions: "video",
    sort: "-views",
    maxResults: "5",
    ...(filters ? { filters } : {}),
  }).toString();
  return { start, end, report: await api(q.toString(), accessToken) };
}

function printReport(title, { start, end, report }) {
  console.log(`\n${title} · ${start} → ${end} · top 5 videos:`);
  console.log("  " + (report.columnHeaders || []).map((h) => h.name).join(" | "));
  for (const row of report.rows || []) console.log("  " + row.join(" | "));
  if (!(report.rows || []).length) console.log("  (ไม่มีวิวในช่วงนี้)");
}

const command = process.argv[2];
const cms = args.cms && args.cms !== "true" ? args.cms : "";

if (command === "login") {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: (cms ? CMS_SCOPES : CHANNEL_SCOPES).join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== "/oauth") return res.writeHead(404).end();
      const err = u.searchParams.get("error");
      const ok = !err && u.searchParams.get("state") === state && u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(ok ? "<h2>อนุญาตเรียบร้อย กลับไปที่ Claude Code ได้เลย (ปิดหน้านี้ได้)</h2>" : `<h2>ไม่สำเร็จ: ${err || "state ไม่ตรง"}</h2>`);
      server.close();
      if (ok) resolve(u.searchParams.get("code"));
      else reject(new Error(`Google refused: ${err || "state mismatch"}`));
    });
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`เปิดลิงก์นี้ในเบราว์เซอร์บนเครื่องนี้ แล้วล็อกอินด้วย${cms ? "บัญชีผู้ใช้ CMS" : "บัญชีเจ้าของ/ผู้จัดการช่อง"}:\n`);
      console.log(url.toString());
      console.log("\nรอการอนุญาต (สูงสุด 10 นาที)...");
    });
    setTimeout(() => { server.close(); reject(new Error("timed out waiting for sign-in")); }, 10 * 60 * 1000);
  });

  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier });
  if (!tokens.refresh_token) throw new Error("no refresh token returned (remove the app at myaccount.google.com/permissions and run login again)");
  console.log(`\nสำเร็จ · scopes: ${tokens.scope}`);
  if (cms) {
    saveEnv("YT_CMS_OWNER_ID", cms);
    saveEnv("YT_CMS_REFRESH_TOKEN", tokens.refresh_token);
    console.log(`โหมด CMS · refresh token อยู่ใน ${ENV_FILE} (YT_CMS_REFRESH_TOKEN) · ทดสอบช่อง terodigital:`);
    for (const ch of DEFAULT_CHANNELS) printReport(`CMS ${cms} · channel ${ch}`, await topVideos(tokens.access_token, `contentOwner==${cms}`, `channel==${ch}`));
  } else {
    const channels = await listChannels(tokens.access_token);
    for (const c of channels) saveEnv(`YT_REFRESH_TOKEN__${c.id}`, tokens.refresh_token);
    console.log(`refresh token อยู่ใน ${ENV_FILE} (YT_REFRESH_TOKEN__<channelId>) · ช่องที่บัญชีนี้เข้าถึงได้:`);
    for (const c of channels) console.log(`  - ${c.title} (${c.id}) · ${c.videos} videos`);
    if (!channels.length) console.log("  (ไม่มี) บัญชีนี้ไม่ใช่เจ้าของ/ผู้จัดการช่อง หรือเลือก Brand Account ผิดตอนล็อกอิน");
  }
} else if (command === "check") {
  let any = false;
  if (process.env.YT_CMS_REFRESH_TOKEN && process.env.YT_CMS_OWNER_ID) {
    any = true;
    const owner = process.env.YT_CMS_OWNER_ID;
    const listed = (process.env.YT_CMS_CHANNELS || "").split(",").map((c) => c.trim()).filter(Boolean);
    const channels = args.channel ? [args.channel] : listed.length ? listed : DEFAULT_CHANNELS;
    const { access_token } = await tokenRequest({ grant_type: "refresh_token", refresh_token: process.env.YT_CMS_REFRESH_TOKEN });
    for (const ch of channels) printReport(`CMS ${owner} · channel ${ch}`, await topVideos(access_token, `contentOwner==${owner}`, `channel==${ch.trim()}`));
  }
  for (const [key, refresh] of Object.entries(process.env)) {
    if (!key.startsWith("YT_REFRESH_TOKEN__") || !refresh) continue;
    any = true;
    const { access_token } = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    for (const c of await listChannels(access_token)) printReport(c.title, await topVideos(access_token, `channel==${c.id}`));
  }
  if (!any) throw new Error(`no YouTube Analytics token in ${ENV_FILE}: run "login" first`);
} else if (command === "save") {
  // Hand the CMS account to the daily sync: Firestore syncSecrets/youtube_cms (no client can read it),
  // then clear the token from .env.local. FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 targets the emulator.
  if (!process.env.YT_CMS_REFRESH_TOKEN || !process.env.YT_CMS_OWNER_ID) throw new Error(`run "login --cms=…" first`);
  const { Firestore, getAccessToken } = await import("../lib/integrations/firestoreRest.ts");
  const { saveCmsAccount, loadCmsAccount } = await import("../lib/integrations/youtubeAnalytics.ts");
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  let db;
  if (emulator) db = new Firestore(JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default, "owner");
  else {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
    db = new Firestore(sa.project_id, await getAccessToken(sa));
  }
  const listed = (args.channels || "").split(",").map((c) => c.trim()).filter(Boolean);
  await saveCmsAccount(db, { ownerId: process.env.YT_CMS_OWNER_ID, refreshToken: process.env.YT_CMS_REFRESH_TOKEN, channels: listed.length ? listed : DEFAULT_CHANNELS });
  const back = await loadCmsAccount(db);
  if (!back || back.refreshToken !== process.env.YT_CMS_REFRESH_TOKEN) throw new Error("saved account could not be read back: .env.local left as is");
  const text = fs.readFileSync(ENV_FILE, "utf8").replace(/^YT_CMS_REFRESH_TOKEN=.*\r?\n?/m, "");
  fs.writeFileSync(ENV_FILE, text);
  console.log(`saved to ${emulator ? "emulator" : "PRODUCTION"} syncSecrets/youtube_cms · channels ${back.channels.join(", ")} · token removed from ${ENV_FILE}`);
} else {
  console.log("usage: node scripts/youtube-analytics-auth.mjs login [--cms=<contentOwnerId>] | check [--channel=UC…] | save [--channels=UC…,UC…]");
}
