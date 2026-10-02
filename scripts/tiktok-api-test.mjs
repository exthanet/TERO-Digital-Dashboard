#!/usr/bin/env node
/**
 * Read-only test of the TikTok Display API (Login Kit, scopes user.info.basic + video.list):
 * list every video of the authorised account and compare its numbers with Metricool.
 * Writes nothing to Firestore. Prints no tokens.
 *
 *   node scripts/tiktok-api-test.mjs [--since=2024-01-01]
 *
 * Needs in .env.local: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
 * (and METRICOOL_API_TOKEN / METRICOOL_USER_ID, already there for the sync).
 * If TikTok issues a new refresh token, it is saved back into .env.local.
 * Details go to output/tiktok-api-test/ (git-ignored).
 */
import fs from "node:fs";
import path from "node:path";
import { MetricoolApi } from "../lib/integrations/metricoolSync.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const since = args.since || "2024-01-01";
const ENV_FILE = ".env.local";
const outDir = path.join("output", "tiktok-api-test");

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const need = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"].filter((k) => !process.env[k]);
if (need.length) {
  console.error(`missing in ${ENV_FILE}: ${need.join(", ")}`);
  process.exit(1);
}

/** Replace one KEY=value line in .env.local (or add it); never prints the value. */
function saveEnv(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  fs.writeFileSync(ENV_FILE, re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, "\n")}${key}=${value}\n`);
}

// ---------- TikTok ----------

async function accessToken() {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error(`token refresh failed: ${body.error || res.status} ${body.error_description || ""}`.trim());
  const rotated = body.refresh_token && body.refresh_token !== process.env.TIKTOK_REFRESH_TOKEN;
  if (rotated) saveEnv("TIKTOK_REFRESH_TOKEN", body.refresh_token);
  console.log(`token: ok · scope ${body.scope} · access valid ${Math.round(body.expires_in / 3600)} h · refresh valid ${Math.round(body.refresh_expires_in / 86400)} days · refresh token ${rotated ? "ROTATED (saved to .env.local)" : "unchanged"}`);
  return body.access_token;
}

const FIELDS = "id,create_time,title,video_description,duration,share_url,cover_image_url,view_count,like_count,comment_count,share_count";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sinceSec = Date.parse(`${since}T00:00:00+07:00`) / 1000;

/** Newest first, 20 per page; stops once a page reaches videos older than --since. Waits and retries on rate limits. */
async function listVideos(token) {
  const videos = [];
  let cursor;
  for (let page = 1; page <= 500; page++) {
    let body;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${FIELDS}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
      });
      body = await res.json();
      if (body.error?.code === "rate_limit_exceeded" && attempt <= 6) {
        const wait = 15_000 * attempt;
        console.log(`  page ${page}: rate limited, waiting ${wait / 1000}s (${videos.length} videos so far)`);
        await sleep(wait);
        continue;
      }
      if (!res.ok || body.error?.code !== "ok") throw new Error(`video/list page ${page}: ${body.error?.code} ${body.error?.message || res.status} (${videos.length} videos read)`);
      break;
    }
    const batch = body.data?.videos || [];
    videos.push(...batch);
    if (page % 10 === 0) console.log(`  ${page} pages · ${videos.length} videos`);
    if (!body.data?.has_more || (batch.length && Math.min(...batch.map((v) => v.create_time)) < sinceSec)) break;
    cursor = body.data.cursor;
    await sleep(1500);
  }
  return videos;
}

async function userInfo(token) {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  return body.data?.user?.display_name || "?";
}

// ---------- Metricool, for comparison ----------

async function metricoolTikTok() {
  const api = new MetricoolApi({ userId: process.env.METRICOOL_USER_ID, apiToken: process.env.METRICOOL_API_TOKEN });
  const brands = JSON.parse(fs.readFileSync("config/metricool-brands.json", "utf8")).filter((b) => b.enabled);
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map();
  for (const brand of brands) {
    for (const p of await api.fetchPosts("tiktok", brand.blogId, since, today)) {
      if (p.videoId) byId.set(String(p.videoId), { brand: brand.label, views: Number(p.viewCount) || 0, likes: Number(p.likeCount) || 0, comments: Number(p.commentCount) || 0, shares: Number(p.shareCount) || 0 });
    }
  }
  return byId;
}

// ---------- main ----------

const token = await accessToken();
console.log(`account: ${await userInfo(token)}`);
const videos = await listVideos(token);
const inRange = videos.filter((v) => new Date(v.create_time * 1000).toISOString().slice(0, 10) >= since);
console.log(`TikTok API: ${videos.length} videos (${inRange.length} since ${since}) · newest ${videos[0] ? new Date(videos[0].create_time * 1000).toISOString().slice(0, 10) : "-"}`);

const mc = await metricoolTikTok();
console.log(`Metricool: ${mc.size} TikTok posts since ${since} (all enabled brands)`);

const rows = [];
let matched = 0, same = 0;
const diffs = [];
for (const v of inRange) {
  const m = mc.get(String(v.id));
  const row = { id: v.id, date: new Date(v.create_time * 1000).toISOString().slice(0, 10), api_views: v.view_count, api_likes: v.like_count, api_comments: v.comment_count, api_shares: v.share_count,
    mc_views: m?.views ?? "", mc_likes: m?.likes ?? "", mc_comments: m?.comments ?? "", mc_shares: m?.shares ?? "", mc_brand: m?.brand ?? "", title: String(v.title || v.video_description || "").slice(0, 80) };
  rows.push(row);
  if (!m) continue;
  matched++;
  if (m.views === v.view_count) same++;
  diffs.push(m.views ? (v.view_count - m.views) / m.views : 0);
}
const apiIds = new Set(inRange.map((v) => String(v.id)));
const onlyMetricool = [...mc.entries()].filter(([id, m]) => !apiIds.has(id));

diffs.sort((a, b) => a - b);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`matched by video id: ${matched} of ${inRange.length} · identical views: ${same}`);
if (diffs.length) console.log(`views TikTok API vs Metricool: median ${pct(diffs[Math.floor(diffs.length / 2)])} · lowest ${pct(diffs[0])} · highest ${pct(diffs.at(-1))}`);
console.log(`only in TikTok API: ${inRange.length - matched} · only in Metricool: ${onlyMetricool.length} (${[...new Set(onlyMetricool.map(([, m]) => m.brand))].join(", ") || "-"})`);

fs.mkdirSync(outDir, { recursive: true });
const cols = Object.keys(rows[0] || { id: "" });
const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
fs.writeFileSync(path.join(outDir, "compare.csv"), csv);
console.log(`details: ${outDir}/compare.csv`);
