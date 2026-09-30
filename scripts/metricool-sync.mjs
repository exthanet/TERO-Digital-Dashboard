#!/usr/bin/env node
/**
 * Metricool → master data sync (multi-brand).
 *
 * Test run (default): fetch, convert and merge in memory against a baseline
 * file, then write a report. Nothing is written to Firestore.
 *
 *   node scripts/metricool-sync.mjs --since=2026-08-01
 *   node scripts/metricool-sync.mjs --since=2026-08-01 --until=2026-09-29 --baseline=public/master-data.json
 *
 * Credentials: METRICOOL_API_TOKEN, METRICOOL_USER_ID (env or .env.local).
 * Brands: config/metricool-brands.json (only "enabled": true are fetched).
 */
import fs from "node:fs";
import path from "node:path";
import {
  MetricoolApi,
  NETWORKS,
  buildSnapshot,
  dedupeDigitalRows,
  chunkSnapshot,
  mapPost,
  mergeIntoMaster,
  rowKey,
} from "../lib/integrations/metricoolSync.ts";
import { YouTubeDataApi, combineYouTube, mapYouTubeVideo } from "../lib/integrations/youtubeData.ts";
import { getAccessToken, loadMasterRows } from "../lib/integrations/firestoreRest.ts";
import { validateMerge } from "../lib/integrations/syncValidation.ts";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);
const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const since = args.since || "2026-08-01";
const until = args.until || today;
const baselineFile = args.baseline || "public/master-data.json";
const outDir = args.out || path.join("output", "metricool-test-run");

// Firestore stores dates as "YYYY-MM-DDT16:59:56Z" (4 s before Bangkok
// midnight of the NEXT day), so the Bangkok date is the day after the UTC one.
const toIso = (d) => {
  const s = String(d || "");
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(Date.parse(s) + 7 * 3600000 + 60000).toISOString().slice(0, 10);
  return s.slice(0, 10);
};

const api = new MetricoolApi({
  userId: process.env.METRICOOL_USER_ID,
  apiToken: process.env.METRICOOL_API_TOKEN,
});
const youtube = process.env.YOUTUBE_API_KEY ? new YouTubeDataApi(process.env.YOUTUBE_API_KEY) : null;
const brands = JSON.parse(fs.readFileSync("config/metricool-brands.json", "utf8")).filter((b) => b.enabled);

console.log(`Metricool test run ${since} → ${until} · brands: ${brands.map((b) => b.label).join(", ")}`);
const incoming = [];
const fetchStats = [];
for (const brand of brands) {
  const brandYouTube = [];
  for (const network of NETWORKS) {
    // YouTube counts views inside the range only, so ask from `since` to today
    // for lifetime numbers, then keep the videos published in the window.
    const to = network === "youtube" ? today : until;
    let posts = [];
    let error = "";
    try {
      posts = await api.fetchPosts(network, brand.blogId, since, to);
    } catch (e) {
      error = e.message;
    }
    let mapped = 0, skipped = 0, outside = 0;
    for (const p of posts) {
      const row = mapPost(network, p, brand);
      if (!row) { skipped++; continue; }
      const d = toIso(row.Date);
      if (d < since || d > until) { outside++; continue; }
      if (network === "youtube") brandYouTube.push(row);
      else incoming.push(row);
      mapped++;
    }
    fetchStats.push({ brand: brand.label, network, fetched: posts.length, mapped, skipped, outside, error });
    console.log(`  ${brand.label.padEnd(12)} ${network.padEnd(9)} fetched=${String(posts.length).padStart(5)} kept=${String(mapped).padStart(4)} skipped=${skipped} outside=${outside}${error ? ` ERROR ${error}` : ""}`);
  }
  // YouTube Data API: every upload with live lifetime counts, merged over Metricool.
  if (youtube && brand.youtubeChannelId) {
    let error = "";
    let fromApi = [];
    try {
      const sinceUtc = new Date(Date.parse(`${since}T00:00:00Z`) - 7 * 3600000).toISOString();
      // The uploads playlist leaves out unlisted videos (and some lives), so
      // also look up every id Metricool returned.
      const ids = [...new Set([
        ...(await youtube.listUploads(brand.youtubeChannelId, sinceUtc)),
        ...brandYouTube.map((r) => r.Content_ID),
      ])];
      fromApi = (await youtube.videos(ids))
        .map((v) => mapYouTubeVideo(v, brand))
        .filter((r) => r && toIso(r.Date) >= since && toIso(r.Date) <= until);
    } catch (e) {
      error = e.message;
    }
    const { rows, onlyDataApi } = combineYouTube(brandYouTube, fromApi);
    incoming.push(...rows);
    fetchStats.push({ brand: brand.label, network: "youtube-data-api", fetched: fromApi.length, mapped: fromApi.length, onlyDataApi, error });
    console.log(`  ${brand.label.padEnd(12)} yt-dataapi fetched=${String(fromApi.length).padStart(5)} only-in-dataapi=${onlyDataApi}${error ? ` ERROR ${error}` : ""}`);
  } else {
    incoming.push(...brandYouTube);
  }
}

// --baseline=firestore reads live production data (read only) with the
// service account in FIREBASE_SERVICE_ACCOUNT or .secrets/firebase-sync.json.
async function loadBaseline() {
  if (baselineFile !== "firestore") return JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) throw new Error("No service account: set FIREBASE_SERVICE_ACCOUNT or add .secrets/firebase-sync.json");
  const sa = JSON.parse(raw);
  // The dashboard's project, not the key's: a service account from another
  // project works once it is granted access here.
  const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const { rows, docs, updatedAt } = await loadMasterRows(projectId, await getAccessToken(sa));
  console.log(`baseline: Firestore masterData ${rows.length} rows in ${docs} documents (updated ${updatedAt || "?"})`);
  return rows;
}
const original = await loadBaseline();
// The same post imported twice was counted twice; keep one row per post first.
const dedupe = dedupeDigitalRows(original);
const baseline = dedupe.rows;
if (dedupe.removed.length) console.log(`duplicates: ${dedupe.removed.length} extra rows in ${dedupe.groups} posts will be removed (backup: removed-duplicates.json)`);
const result = mergeIntoMaster(baseline, incoming);

// How well does automatic detection agree with what the team labelled?
const byKey = new Map(baseline.map((r) => [rowKey(r), r]).filter(([k]) => k));
const agree = { program: [0, 0], vdo: [0, 0], date: [0, 0] };
const mismatches = { program: {}, vdo: {}, date: [] };
for (const row of incoming) {
  const old = byKey.get(rowKey(row));
  if (!old) continue;
  const cmp = (name, a, b) => {
    agree[name][1]++;
    if (a === b) agree[name][0]++;
    else if (name === "date") mismatches.date.length < 10 && mismatches.date.push(`${row.Platform} ${b}→${a}`);
    else { const k = `${b} → ${a}`; mismatches[name][k] = (mismatches[name][k] || 0) + 1; }
  };
  if (old.Program && old.Program !== "ไม่ระบุ") cmp("program", row.Program, old.Program);
  cmp("vdo", row.VDO_Type, old.VDO_Type);
  cmp("date", toIso(row.Date), toIso(old.Date));
}
// Reverse check: team rows in the window that the API did not return.
const incomingKeys = new Set(incoming.map((r) => rowKey(r)));
const missingFromApi = {};
for (const r of baseline) {
  if (!["Facebook", "Instagram", "TikTok", "YouTube"].includes(r.Platform)) continue;
  const d = toIso(r.Date);
  if (d < since || d > until) continue;
  const key = rowKey(r);
  if (key && incomingKeys.has(key)) continue;
  const k = `${r.Platform} · ${r.Program} · ${key ? "id" : "no-id"}`;
  missingFromApi[k] = (missingFromApi[k] || 0) + 1;
}
const pct = ([a, b]) => (b ? `${((a / b) * 100).toFixed(1)}% (${a}/${b})` : "-");

const newByProgram = {};
for (const r of result.inserted) newByProgram[`${r.Platform} · ${r.Program}`] = (newByProgram[`${r.Platform} · ${r.Program}`] || 0) + 1;
const review = result.inserted.filter((r) => r._review);
const viewGain = result.updated
  .map((u) => ({ key: u.key, before: Number(String(u.before.Views ?? 0).replace(/,/g, "")), after: Number(u.after.Views ?? String(u.before.Views ?? 0).replace(/,/g, "")) }))
  .filter((x) => x.after !== x.before)
  .sort((a, b) => b.after - b.before - (a.after - a.before));

// Daily snapshot that a real run would write (never overwritten).
const snapshot = buildSnapshot(result);
const snapshotChunks = chunkSnapshot(snapshot);
const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));

const summary = {
  window: { since, until, baseline: baselineFile },
  fetch: fetchStats,
  totals: {
    incoming: incoming.length,
    matchedExisting: result.updated.length + result.unchanged,
    updated: result.updated.length,
    unchanged: result.unchanged,
    inserted: result.inserted.length,
    needsReview: review.length,
  },
  agreementWithTeamLabels: { program: pct(agree.program), vdoType: pct(agree.vdo), bangkokDate: pct(agree.date) },
  topMismatches: {
    program: Object.entries(mismatches.program).sort((a, b) => b[1] - a[1]).slice(0, 8),
    vdoType: Object.entries(mismatches.vdo).sort((a, b) => b[1] - a[1]).slice(0, 8),
    date: mismatches.date,
  },
  snapshot: {
    date: today,
    rows: snapshot.length,
    documents: snapshotChunks.length,
    approxKB: Math.round(snapshotBytes / 1024),
    note: "rows = posts whose numbers changed or appeared today; unchanged posts are skipped",
  },
  newRowsByPlatformProgram: newByProgram,
  baselineRowsNotReturnedByApi: missingFromApi,
  biggestViewUpdates: viewGain.slice(0, 10),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
const csv = (rows, cols) =>
  "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
const cols = ["Date", "Publish_Time", "Platform", "Channel", "Program", "VDO_Type", "Topic_Type", "Topic", "Views", "Likes", "Comments", "Shares", "URL"];
fs.writeFileSync(path.join(outDir, "new-rows.csv"), csv(result.inserted, cols));
fs.writeFileSync(path.join(outDir, "needs-review.csv"), csv(review, cols));
fs.writeFileSync(
  path.join(outDir, "updated-rows.csv"),
  csv(result.updated.map((u) => ({ key: u.key, ...Object.fromEntries(Object.entries(u.before).map(([k, v]) => [`old_${k}`, v])), ...Object.fromEntries(Object.entries(u.after).map(([k, v]) => [`new_${k}`, v])) })),
    ["key", "old_Views", "new_Views", "old_Likes", "new_Likes", "old_Comments", "new_Comments", "old_Shares", "new_Shares"]),
);

fs.writeFileSync(
  path.join(outDir, `snapshot-${today}.csv`),
  csv(snapshot.map((r) => ({ key: r.k, views: r.v, likes: r.l, comments: r.c, shares: r.s })), ["key", "views", "likes", "comments", "shares"]),
);
console.log("\n" + JSON.stringify(summary.totals, null, 1));
console.log("snapshot:", summary.snapshot);
console.log("agreement:", summary.agreementWithTeamLabels);
console.log(`report: ${outDir}/summary.json, new-rows.csv, needs-review.csv, updated-rows.csv`);

// Safety checks: all must pass before this data may replace production.
fs.writeFileSync(path.join(outDir, "removed-duplicates.json"), JSON.stringify(dedupe.removed, null, 1));
const validation = validateMerge(baseline, result, incoming, { originalCount: original.length, removed: dedupe.removed });
fs.writeFileSync(path.join(outDir, "validation.json"), JSON.stringify(validation, null, 2));
console.log(`\nvalidation: ${validation.ok ? "PASS" : "FAIL"}`);
for (const c of validation.checks) {
  console.log(`  ${c.pass ? "✔" : "✖"} ${c.name} — ${c.detail}`);
  for (const w of c.warnings || []) console.log(`      · ${w}`);
}
console.log(`  dashboard load: ${validation.stats.dashboardLoadMB.before} → ${validation.stats.dashboardLoadMB.after} MB · reads per open: ${validation.stats.readsPerDashboardOpen.before} → ${validation.stats.readsPerDashboardOpen.after}`);
if (!validation.ok) process.exitCode = 1;
