// Daily backup for GitHub (data-sync workflow, private repo only): reads
// Firestore with the service account and writes CSV + JSON files into a folder
// that the workflow uploads as an artifact kept 90 days.
//
//   node scripts/backup-export.mjs --out=backup [--report=output/metricool-test-run]
//
// Never exported: syncSecrets (tokens), users and anything about sign-in.
// Read-only: nothing in Firestore is changed.
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Firestore, decodeFields, docId, getAccessToken } from "../lib/integrations/firestoreRest.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "1"]));
const outDir = args.out || "backup";
const reportDir = args.report || path.join("output", "metricool-test-run");

/** Collections in the backup. syncSecrets and users are left out on purpose. */
export const BACKUP_COLLECTIONS = ["masterData", "growthDaily", "snapshots", "ytAnalytics", "accMonthly", "revenueData", "affiliateData", "tvCompetitors", "thumbnails", "syncStatus"];

/** Fully in a CSV above, so no JSON copy (snapshots: the CSV holds the newest day; earlier days are in earlier backups). */
const CSV_COMPLETE = new Set(["masterData", "growthDaily", "snapshots", "thumbnails"]);

/** The masterData columns people read first; every other column follows in first-seen order. */
const MASTER_FIRST = ["Date", "Publish_Time", "Platform", "Channel", "Program", "Episode_ID", "Topic", "Topic_Type", "VDO_Type", "Views", "Likes", "Comments", "Shares", "Engagement", "URL", "Content_ID"];
const firstColumns = (rows, first) => {
  const all = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [...first.filter((c) => all.includes(c)), ...all.filter((c) => !first.includes(c))];
};

const cell = (v) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV with a UTF-8 BOM so Excel shows Thai correctly. Columns = every key seen, in first-seen order. */
export function toCsv(rows, columns) {
  const cols = columns || [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
const gz = (fields, key) => {
  const b = fields?.[key]?.bytesValue;
  return b ? JSON.parse(gunzipSync(Buffer.from(b, "base64")).toString("utf8")) : null;
};

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) throw new Error("No service account: set FIREBASE_SERVICE_ACCOUNT or add .secrets/firebase-sync.json");
  const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const db = new Firestore(projectId, await getAccessToken(JSON.parse(raw)));
  fs.mkdirSync(path.join(outDir, "json"), { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(outDir, name), text);
  const files = {};
  const note = (name, rows) => (files[name] = rows);

  const docs = {};
  for (const c of BACKUP_COLLECTIONS) docs[c] = await db.listRaw(c);

  // masterData: one row per post, exactly as stored.
  const master = [];
  for (const d of docs.masterData) {
    const x = decodeFields(d.fields || {});
    if (Array.isArray(x.rows)) master.push(...x.rows);
  }
  write("masterData.csv", toCsv(master, firstColumns(master, MASTER_FIRST)));
  note("masterData.csv", master.length);

  // growthDaily: views etc. gained per post per day.
  const growth = [];
  for (const d of docs.growthDaily) {
    for (const [key, v, l, c, s, isNew] of gz(d.fields, "data") || []) growth.push({ day: docId(d.name), key, views: v, likes: l, comments: c, shares: s, newPost: isNew });
  }
  write("growthDaily.csv", toCsv(growth, ["day", "key", "views", "likes", "comments", "shares", "newPost"]));
  note("growthDaily.csv", growth.length);

  // snapshots: the newest day only (older days are in earlier backups).
  const snapDays = [...new Set(docs.snapshots.map((d) => docId(d.name).split("__")[0]))].sort();
  const lastDay = snapDays[snapDays.length - 1] || "";
  const snap = [];
  for (const d of docs.snapshots) if (docId(d.name).startsWith(lastDay)) for (const r of decodeFields(d.fields || {}).rows || []) snap.push({ date: lastDay, key: r.k, views: r.v, likes: r.l, comments: r.c, shares: r.s });
  write("snapshot-latest.csv", toCsv(snap, ["date", "key", "views", "likes", "comments", "shares"]));
  note("snapshot-latest.csv", snap.length);

  // YouTube Deep Dive: videos as CSV, the rest as JSON.
  const yt = Object.fromEntries(docs.ytAnalytics.map((d) => [docId(d.name), decodeFields(d.fields || {})]));
  const videos = Object.entries(yt).filter(([id]) => id.startsWith("videos_")).sort().flatMap(([, x]) => x.rows || []);
  write("ytAnalytics-videos.csv", toCsv(videos.map(({ traffic, ...v }) => ({ ...v, traffic: traffic ? JSON.stringify(traffic) : "" }))));
  note("ytAnalytics-videos.csv", videos.length);

  // Monthly ACC: one line per month and channel.
  const acc = docs.accMonthly.flatMap((d) => {
    const x = decodeFields(d.fields || {});
    return (x.rows || []).map((r) => ({ month: x.month, through: x.through, updatedAt: x.updatedAt, ...r }));
  });
  write("accMonthly.csv", toCsv(acc));
  note("accMonthly.csv", acc.length);

  // Revenue (imported files): monthly lines per company.
  const revenue = docs.revenueData.flatMap((d) => {
    const x = decodeFields(d.fields || {});
    return Array.isArray(x.monthly) ? x.monthly.map((m) => ({ sheet: docId(d.name), ...m })) : [];
  });
  write("revenue-monthly.csv", toCsv(revenue));
  note("revenue-monthly.csv", revenue.length);

  // Cover-image links.
  const thumbs = docs.thumbnails.flatMap((d) => Object.entries(gz(d.fields, "data") || {}).map(([key, url]) => ({ platform: docId(d.name), key, url })));
  write("thumbnails.csv", toCsv(thumbs, ["platform", "key", "url"]));
  note("thumbnails.csv", thumbs.length);

  // Collections without a full CSV above also as JSON (decoded fields; gzipped data unpacked), for restoring.
  // The others are complete in their CSV; a JSON copy would only double the size.
  for (const c of BACKUP_COLLECTIONS.filter((x) => !CSV_COMPLETE.has(x))) {
    const out = docs[c].map((d) => {
      const fields = decodeFields(d.fields || {});
      for (const [k, v] of Object.entries(d.fields || {})) if (v && "bytesValue" in v) fields[k] = gz(d.fields, k);
      return { id: docId(d.name), fields };
    });
    write(path.join("json", `${c}.json`), JSON.stringify(out));
    note(`json/${c}.json`, out.length);
  }

  // The sync's own report files of this run (validation, new rows, rows to review, ...).
  if (fs.existsSync(reportDir)) {
    fs.mkdirSync(path.join(outDir, "sync-report"), { recursive: true });
    for (const f of fs.readdirSync(reportDir)) {
      const from = path.join(reportDir, f);
      if (fs.statSync(from).isFile()) {
        fs.copyFileSync(from, path.join(outDir, "sync-report", f));
        note(`sync-report/${f}`, 1);
      }
    }
  }

  const manifest = { createdAt: new Date().toISOString(), project: projectId, collections: BACKUP_COLLECTIONS, files };
  write("manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`backup: ${Object.keys(files).length} files in ${outDir} · masterData ${master.length} rows`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("backup-export.mjs")) {
  main().catch((e) => {
    console.error(`backup failed: ${e.message}`);
    process.exit(1);
  });
}
