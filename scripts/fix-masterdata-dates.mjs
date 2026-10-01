#!/usr/bin/env node
/**
 * One-off: store masterData dates as the real day ("YYYY-MM-DD").
 *
 * Firestore holds every Date as an instant "YYYY-MM-DDT16:59:56Z", 4 seconds
 * before Bangkok midnight of the intended day, so anyone reading the raw data
 * gets the day before. This rewrites only that value; every other field is
 * kept exactly as stored (the raw Firestore JSON is edited in place, nothing
 * is decoded and re-encoded).
 *
 *   node scripts/fix-masterdata-dates.mjs                 # test: checks + report, no writes
 *   node scripts/fix-masterdata-dates.mjs --write         # backup, check, then write
 *   node scripts/fix-masterdata-dates.mjs --restore=backups/masterData-<time>.json
 *
 * Credentials: .secrets/firebase-sync.json (service account with Cloud
 * Datastore User on the dashboard project).
 */
import fs from "node:fs";
import path from "node:path";
import { getAccessToken, decodeFields } from "../lib/integrations/firestoreRest.ts";
import { excelDate } from "../lib/dashboard/normalize.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || "true"]; }));
const PROJECT = JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
const token = await getAccessToken(sa);
const auth = { authorization: `Bearer ${token}` };

async function listRaw(collection) {
  const docs = [];
  let pageToken = "";
  do {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: auth });
    const body = await res.json();
    if (!res.ok) throw new Error(`list ${collection}: ${body.error?.message || res.status}`);
    docs.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return docs;
}

/** Replace a whole document, only if nobody changed it since `updateTime`. */
async function writeRaw(doc, updateTime) {
  const url = new URL(`https://firestore.googleapis.com/v1/${doc.name}`);
  if (updateTime) url.searchParams.set("currentDocument.updateTime", updateTime);
  const res = await fetch(url, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ fields: doc.fields }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`write ${doc.name.split("/").pop()}: ${body.error?.message || res.status}`);
  return body;
}

// ---------- restore ----------
if (args.restore) {
  const backup = JSON.parse(fs.readFileSync(args.restore, "utf8"));
  console.log(`restoring ${backup.documents.length} documents from ${args.restore} (taken ${backup.takenAt})`);
  for (const d of backup.documents) await writeRaw(d);
  console.log("restore done");
  process.exit(0);
}

// ---------- plan ----------
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/** The real day of a stored instant: Bangkok calendar day, 1-minute margin for the 23:59:56 rounding. */
const realDay = (iso) => new Date(Date.parse(iso) + 7 * 3600000 + 60000).toISOString().slice(0, 10);

const docs = await listRaw("masterData");
const plan = [];
let rowsTotal = 0, toChange = 0, alreadyPlain = 0;
const unexpected = [];
for (const doc of docs) {
  const values = doc.fields?.rows?.arrayValue?.values;
  if (!values) { plan.push({ doc, changed: 0 }); continue; }
  const next = structuredClone(doc);
  let changed = 0;
  next.fields.rows.arrayValue.values.forEach((v, i) => {
    rowsTotal++;
    const dateNode = v.mapValue?.fields?.Date;
    if (!dateNode) { unexpected.push(`${doc.name.split("/").pop()}#${i} no Date`); return; }
    if ("timestampValue" in dateNode && INSTANT.test(dateNode.timestampValue)) {
      v.mapValue.fields.Date = { stringValue: realDay(dateNode.timestampValue) };
      changed++;
    } else if ("stringValue" in dateNode && /^\d{4}-\d{2}-\d{2}$/.test(dateNode.stringValue)) {
      alreadyPlain++;
    } else {
      unexpected.push(`${doc.name.split("/").pop()}#${i} ${JSON.stringify(dateNode).slice(0, 60)}`);
    }
  });
  toChange += changed;
  plan.push({ doc, next, changed });
}

// ---------- checks (all must pass before writing) ----------
const checks = [];
const add = (name, pass, detail, samples = []) => checks.push({ name, pass, detail, samples });
const flat = (d) => (d.fields?.rows?.arrayValue?.values || []).map((v) => decodeFields(v.mapValue?.fields || {}));

// A. Row counts per document unchanged; only the Date field differs.
let otherDiffs = 0, rowCountDiffs = 0;
const diffSamples = [];
for (const p of plan) {
  if (!p.next) continue;
  const a = p.doc.fields.rows.arrayValue.values, b = p.next.fields.rows.arrayValue.values;
  if (a.length !== b.length) rowCountDiffs++;
  a.forEach((v, i) => {
    const fa = v.mapValue?.fields || {}, fb = b[i].mapValue?.fields || {};
    for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
      if (k === "Date") continue;
      if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k])) { otherDiffs++; if (diffSamples.length < 5) diffSamples.push(`${p.doc.name.split("/").pop()}#${i}.${k}`); }
    }
  });
  const outside = Object.keys(p.doc.fields).filter((k) => k !== "rows" && JSON.stringify(p.doc.fields[k]) !== JSON.stringify(p.next.fields[k]));
  if (outside.length) { otherDiffs += outside.length; diffSamples.push(`${p.doc.name.split("/").pop()} ${outside.join(",")}`); }
}
add("A. จำนวนแถวเท่าเดิม และเปลี่ยนเฉพาะคอลัมน์ Date", rowCountDiffs === 0 && otherDiffs === 0, `${docs.length} documents · ${rowsTotal} แถว · ค่าอื่นที่เปลี่ยน ${otherDiffs}`, diffSamples);

// B. Every Date recognised; nothing left in an unknown shape.
add("B. อ่านวันที่ได้ครบทุกแถว", unexpected.length === 0, `แปลง ${toChange} · เป็น YYYY-MM-DD อยู่แล้ว ${alreadyPlain} · รูปแบบอื่น ${unexpected.length}`, unexpected.slice(0, 5));

// C. What the dashboard shows today is exactly the new stored day (no visible change).
let shownSame = 0, shownTotal = 0;
const shownSamples = [];
for (const p of plan) {
  if (!p.next) continue;
  const before = flat(p.doc), after = flat(p.next);
  before.forEach((r, i) => { shownTotal++; if (excelDate(r.Date) === after[i].Date) shownSame++; else if (shownSamples.length < 5) shownSamples.push(`${r.Date} → ${after[i].Date}`); });
}
add("C. วันที่ใหม่ตรงกับที่ dashboard แสดงอยู่ตอนนี้", shownSame === shownTotal, `${shownSame}/${shownTotal}`, shownSamples);

// D. Matches the team's source sheet (data/master-data.json, dd/mm/yyyy) wherever the post is in both.
const sheet = JSON.parse(fs.readFileSync("data/master-data.json", "utf8"));
const sheetDay = (d) => { const m = String(d || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };
const key = (r) => `${r.Platform}|${String(r.URL || "")}|${String(r.Topic || "").slice(0, 40)}`;
const sheetByKey = new Map();
for (const r of sheet) { const k = key(r); sheetByKey.set(k, sheetByKey.has(k) ? null : sheetDay(r.Date)); } // null = ambiguous key
let sheetMatch = 0, sheetTotal = 0;
const sheetSamples = [];
for (const p of plan) {
  if (!p.next) continue;
  for (const r of flat(p.next)) {
    const want = sheetByKey.get(key(r));
    if (!want) continue;
    sheetTotal++;
    if (want === r.Date) sheetMatch++; else if (sheetSamples.length < 5) sheetSamples.push(`${r.Platform} ${String(r.Topic).slice(0, 30)}: sheet ${want} / new ${r.Date}`);
  }
}
add("D. ตรงกับไฟล์ต้นทางของทีม (master-data.json)", sheetTotal > 0 && sheetMatch === sheetTotal, `${sheetMatch}/${sheetTotal}`, sheetSamples);

const ok = checks.every((c) => c.pass);
console.log(`masterData ${docs.length} documents, ${rowsTotal} rows · dates to rewrite: ${toChange}`);
for (const c of checks) {
  console.log(`  ${c.pass ? "✔" : "✖"} ${c.name} — ${c.detail}`);
  for (const s of c.samples) console.log(`      · ${s}`);
}
const sample = plan.find((p) => p.changed)?.next;
if (sample) {
  const before = flat(plan.find((p) => p.changed).doc).slice(0, 3), after = flat(sample).slice(0, 3);
  console.log("  example:", before.map((r, i) => `${r.Platform} ${r.Date} → ${after[i].Date}`).join(" | "));
}
console.log(`checks: ${ok ? "PASS" : "FAIL"}`);

if (!args.write) {
  console.log("test mode: nothing written (add --write to apply)");
  process.exit(ok ? 0 : 1);
}
if (!ok) { console.error("not writing: a check failed"); process.exit(1); }

// ---------- backup, then write ----------
const takenAt = new Date().toISOString();
fs.mkdirSync("backups", { recursive: true });
const backupFile = path.join("backups", `masterData-${takenAt.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backupFile, JSON.stringify({ project: PROJECT, collection: "masterData", takenAt, documents: docs.map((d) => ({ name: d.name, fields: d.fields })) }));
console.log(`backup: ${backupFile} (${(fs.statSync(backupFile).size / 1e6).toFixed(1)} MB) · restore with --restore=${backupFile}`);

let written = 0;
for (const p of plan) {
  if (!p.changed) continue;
  await writeRaw(p.next, p.doc.updateTime);
  written++;
}
console.log(`written: ${written} documents`);

// Read back and confirm every Date is now a plain day.
const after = await listRaw("masterData");
const leftover = after.flatMap((d) => (d.fields?.rows?.arrayValue?.values || []).filter((v) => !("stringValue" in (v.mapValue?.fields?.Date || {})))).length;
console.log(`verify: ${leftover === 0 ? "all dates are YYYY-MM-DD" : `${leftover} rows still not plain dates`}`);
process.exit(leftover === 0 ? 0 : 1);
