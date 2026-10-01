#!/usr/bin/env node
/**
 * Move the YouTube Revenue and Affiliate reports from the local JSON files in
 * data/ (kept off git) into Firestore, so the dashboard reads them behind sign-in and the
 * files no longer need to be published.
 *
 * Writes exactly what the in-app "บันทึกขึ้น Cloud" writes
 * (saveRevenueDataToFirebase / saveAffiliateDataToFirebase in lib/firebase.ts):
 *   revenueData/meta, revenueData/monthly
 *   affiliateData/meta, affiliateData/summary, affiliateData/{content,product,daily}_### (400 rows each)
 * then reads everything back the way the dashboard does and checks it equals the file.
 *
 *   node scripts/import-reports-to-firestore.mjs            # dry run: what would be written
 *   node scripts/import-reports-to-firestore.mjs --write    # write, then verify
 *   --only=affiliate | --only=revenue                         # one report only
 *
 * Refuses to write when a collection already has documents (nothing is overwritten).
 * Credentials: FIREBASE_SERVICE_ACCOUNT or .secrets/firebase-sync.json;
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 runs against the local emulator.
 */
import fs from "node:fs";
import { Firestore, decodeFields, docId, encodeFields, getAccessToken } from "../lib/integrations/firestoreRest.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const write = args.write === "true";
const revenueFile = args["revenue-file"] || "data/youtube-revenue.json";
const affiliateFile = args["affiliate-file"] || "data/affiliate-data.json";
const CHUNK = 400; // same as saveAffiliateDataToFirebase

// ---------- the documents the in-app save writes ----------

const clean = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v]));
const pad = (i) => String(i).padStart(3, "0");

function revenueDocs(data, now) {
  return [
    ["revenueData/meta", { generatedAt: data.generatedAt || now, updatedAt: now }],
    ["revenueData/monthly", { monthly: data.monthly.map(clean), updatedAt: now }],
  ];
}

function affiliateDocs(data, now) {
  const docs = [
    ["affiliateData/meta", { generatedAt: data.generatedAt || now, updatedAt: now }],
    ["affiliateData/summary", { summary: data.summary.map(clean), updatedAt: now }],
  ];
  for (const [key, prefix] of [["contents", "content"], ["products", "product"], ["daily", "daily"]]) {
    for (let i = 0, n = 0; i < data[key].length; i += CHUNK, n++) {
      docs.push([`affiliateData/${prefix}_${pad(n)}`, { index: n, rows: data[key].slice(i, i + CHUNK).map(clean), updatedAt: now }]);
    }
  }
  return docs;
}

// ---------- reading back like the dashboard (loadRevenueDataFromFirebase / loadAffiliateDataFromFirebase) ----------

function readRevenue(docs) {
  const by = Object.fromEntries(docs.map((d) => [docId(d.name), decodeFields(d.fields || {})]));
  return { monthly: by.monthly?.monthly || [] };
}

function readAffiliate(docs) {
  const out = { summary: [], contents: [], products: [], daily: [] };
  // getDocs returns documents ordered by id, as the REST list does.
  for (const d of [...docs].sort((a, b) => docId(a.name).localeCompare(docId(b.name)))) {
    const id = docId(d.name);
    const data = decodeFields(d.fields || {});
    if (id === "summary") out.summary = data.summary || [];
    else if (id.startsWith("content_") && Array.isArray(data.rows)) out.contents.push(...data.rows);
    else if (id.startsWith("product_") && Array.isArray(data.rows)) out.products.push(...data.rows);
    else if (id.startsWith("daily_") && Array.isArray(data.rows)) out.daily.push(...data.rows);
  }
  return out;
}

/** JSON with sorted keys: Firestore returns map fields in its own order. */
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object"
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
    : JSON.stringify(v);

function compare(name, expected, actual) {
  const problems = [];
  for (const key of Object.keys(expected)) {
    const e = expected[key];
    const a = actual[key] || [];
    if (e.length !== a.length) problems.push(`${name}.${key}: file ${e.length} rows, Firestore ${a.length}`);
    else {
      const bad = e.findIndex((row, i) => canon(clean(row)) !== canon(a[i]));
      if (bad >= 0) problems.push(`${name}.${key}: row ${bad} differs`);
    }
  }
  return problems;
}

// ---------- main ----------

const revenue = JSON.parse(fs.readFileSync(revenueFile, "utf8"));
const affiliate = JSON.parse(fs.readFileSync(affiliateFile, "utf8"));
const now = new Date().toISOString();
const only = args.only || "";
if (only && !["revenue", "affiliate"].includes(only)) throw new Error("--only must be revenue or affiliate");
const plan = {
  ...(only !== "affiliate" ? { revenueData: revenueDocs(revenue, now) } : {}),
  ...(only !== "revenue" ? { affiliateData: affiliateDocs(affiliate, now) } : {}),
};

if (plan.revenueData) console.log(`Revenue: ${revenue.monthly.length} months (${revenue.monthly[0]?.month} → ${revenue.monthly.at(-1)?.month}) → ${plan.revenueData.length} documents`);
if (plan.affiliateData) console.log(`Affiliate: summary ${affiliate.summary.length} · contents ${affiliate.contents.length} · products ${affiliate.products.length} · daily ${affiliate.daily.length} → ${plan.affiliateData.length} documents`);
const biggest = Math.max(...Object.values(plan).flat().map(([, f]) => Buffer.byteLength(JSON.stringify(f))));
console.log(`largest document ≈ ${Math.round(biggest / 1024)} KB (Firestore limit 1,024 KB)`);
if (biggest > 900_000) throw new Error("a document would be too large");

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
let db;
if (emulator) {
  db = new Firestore(process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default, "owner");
} else {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(".secrets/firebase-sync.json", "utf8");
  const sa = JSON.parse(raw);
  db = new Firestore(sa.project_id, await getAccessToken(sa));
}
console.log(`target: ${emulator ? `emulator ${emulator}` : "PRODUCTION Firestore"}`);

for (const collection of Object.keys(plan)) {
  const existing = await db.listRaw(collection);
  if (existing.length) {
    console.error(`${collection} already has ${existing.length} document(s): nothing written (this script never overwrites)`);
    process.exit(1);
  }
}
if (!write) {
  console.log("dry run: nothing written (add --write to write)");
  process.exit(0);
}

for (const [collection, docs] of Object.entries(plan)) {
  for (const [path, fields] of docs) await db.set(path, encodeFields(fields), { mustNotExist: true });
  console.log(`written: ${collection} ${docs.length} documents`);
}

const problems = [
  ...(plan.revenueData ? compare("revenue", { monthly: revenue.monthly }, readRevenue(await db.listRaw("revenueData"))) : []),
  ...(plan.affiliateData
    ? compare("affiliate", { summary: affiliate.summary, contents: affiliate.contents, products: affiliate.products, daily: affiliate.daily }, readAffiliate(await db.listRaw("affiliateData")))
    : []),
];
if (problems.length) {
  console.error("VERIFY FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`verify: Firestore matches the file${Object.keys(plan).length > 1 ? "s" : ""} row for row`);
