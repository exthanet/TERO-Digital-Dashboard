// Daily backup onto this PC, apart from the sync (Windows Task Scheduler runs it;
// see docs/SYNC_SETUP_TH.md). Read-only: nothing in Firestore is changed.
//
//   node scripts/backup-local.mjs                      today's backup into backups/daily/YYYY-MM-DD
//   node scripts/backup-local.mjs --firestore-backups  also every sync backup in Firestore (masterDataBackups)
//   node scripts/backup-local.mjs --keep=30            daily folders kept (default 30; older ones are removed)
//
// backups/ is in .gitignore: real data, never commit it.
//   backups/daily/YYYY-MM-DD/           CSV + JSON (as backup-export.mjs) and masterData.raw.json.gz
//   backups/firestore-backups/{run}.json.gz   one sync backup, documents exactly as stored (never removed here)
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { connect, exportBackup } from "./backup-export.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "1"]));
const root = args.root || path.join("backups", "daily");
const keep = Math.max(1, Number(args.keep || 30));
const DAILY = /^\d{4}-\d{2}-\d{2}(_\d{4})?$/;

const bangkok = () => new Date(Date.now() + 7 * 3600000).toISOString();
const sizeOf = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((a, f) => a + sizeOf(path.join(p, f)), 0) : fs.statSync(p).size);
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const rowsIn = (docs) => docs.reduce((a, d) => a + (d.fields?.rows?.arrayValue?.values?.length || 0), 0);

/** A new folder for this run: a second run on the same day never overwrites the first. */
function newFolder() {
  const now = bangkok();
  let dir = path.join(root, now.slice(0, 10));
  if (fs.existsSync(dir)) dir = `${dir}_${now.slice(11, 13)}${now.slice(14, 16)}`;
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Every sync backup in Firestore, one gzipped file per run; runs already saved are skipped. */
async function saveFirestoreBackups(db) {
  const dir = path.join("backups", "firestore-backups");
  fs.mkdirSync(dir, { recursive: true });
  const names = await db.listNames("masterDataBackups");
  const runs = [...new Set(names.map((n) => n.split("__")[0]))].sort();
  const saved = [];
  for (const run of runs) {
    const file = path.join(dir, `${run}.json.gz`);
    if (fs.existsSync(file)) { saved.push({ run, skipped: "มีอยู่แล้ว" }); continue; }
    const ids = names.filter((n) => n === run || n.startsWith(`${run}__`));
    const docs = [];
    // A few at a time: copies are up to 1 MB each.
    for (let i = 0; i < ids.length; i += 6) {
      const got = await Promise.all(ids.slice(i, i + 6).map((id) => db.get(`masterDataBackups/${id}`)));
      docs.push(...got.filter(Boolean));
    }
    if (docs.length !== ids.length) throw new Error(`backup ${run}: read ${docs.length} of ${ids.length} documents`);
    const copies = docs.filter((d) => d.name.includes("__"));
    const rows = copies.reduce((a, d) => a + (d.fields?.data?.mapValue?.fields?.rows?.arrayValue?.values?.length || 0), 0);
    fs.writeFileSync(file, gzipSync(JSON.stringify(docs)));
    saved.push({ run, documents: docs.length, rows, bytes: fs.statSync(file).size });
    console.log(`  firestore backup ${run}: ${docs.length} documents · ${rows} rows · ${mb(fs.statSync(file).size)}`);
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({ updatedAt: new Date().toISOString(), runs: saved }, null, 2));
  return saved;
}

/** Keep the newest `keep` daily folders; anything else in backups/ is never touched. */
function prune() {
  if (!fs.existsSync(root)) return [];
  const daily = fs.readdirSync(root).filter((f) => DAILY.test(f) && fs.statSync(path.join(root, f)).isDirectory()).sort();
  const drop = daily.slice(0, Math.max(0, daily.length - keep));
  for (const f of drop) fs.rmSync(path.join(root, f), { recursive: true, force: true });
  return drop;
}

async function main() {
  const startedAt = Date.now();
  const { db, projectId } = await connect();
  const dir = newFolder();
  const { manifest, docs } = await exportBackup(db, projectId, dir);
  // masterData exactly as stored, so it can be put back document for document.
  fs.writeFileSync(path.join(dir, "masterData.raw.json.gz"), gzipSync(JSON.stringify(docs.masterData)));
  const rawRows = rowsIn(docs.masterData);
  if (rawRows !== manifest.files["masterData.csv"]) throw new Error(`masterData: ${rawRows} rows stored but ${manifest.files["masterData.csv"]} in the CSV`);

  const firestoreBackups = args["firestore-backups"] ? await saveFirestoreBackups(db) : null;
  const removed = prune();
  const local = {
    createdAt: new Date().toISOString(),
    folder: dir,
    masterData: { documents: docs.masterData.length, rows: rawRows },
    bytes: sizeOf(dir),
    seconds: Math.round((Date.now() - startedAt) / 1000),
    ...(firestoreBackups ? { firestoreBackups } : {}),
    removedFolders: removed,
  };
  fs.writeFileSync(path.join(dir, "local-backup.json"), JSON.stringify(local, null, 2));
  console.log(`local backup: ${dir} · masterData ${rawRows} rows in ${docs.masterData.length} documents · ${mb(local.bytes)} · ${local.seconds}s`);
  if (removed.length) console.log(`removed old daily folders (keep ${keep}): ${removed.join(", ")}`);
}

main().catch((e) => {
  console.error(`local backup failed: ${e.message}`);
  process.exit(1);
});
