// After the workflow uploads a backup artifact: list it in Firestore
// backups/{runId} (admins read; shown in "สถานะการ Sync") and drop entries
// older than the artifact's 90 days, when GitHub deletes the file.
//
//   ARTIFACT_URL=… ARTIFACT_ID=… RUN_URL=… SYNC_OUTCOME=success node scripts/backup-record.mjs --dir=backup
import fs from "node:fs";
import path from "node:path";
import { Firestore, docId, encodeFields, getAccessToken } from "../lib/integrations/firestoreRest.ts";

export const BACKUP_DAYS = 90;

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "1"]));
const dir = args.dir || "backup";

const sizeOf = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((a, f) => a + sizeOf(path.join(p, f)), 0) : fs.statSync(p).size);

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) throw new Error("No service account");
  const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const db = new Firestore(projectId, await getAccessToken(JSON.parse(raw)));
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const now = new Date();
  const id = now.toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
  await db.set(
    `backups/${id}`,
    encodeFields({
      createdAt: manifest.createdAt,
      expiresAt: new Date(now.getTime() + BACKUP_DAYS * 86400000).toISOString(),
      artifactUrl: process.env.ARTIFACT_URL || "",
      artifactId: process.env.ARTIFACT_ID || "",
      runUrl: process.env.RUN_URL || "",
      syncOutcome: process.env.SYNC_OUTCOME || "",
      sizeBytes: sizeOf(dir),
      masterDataRows: manifest.files?.["masterData.csv"] || 0,
      files: Object.keys(manifest.files || {}),
    }),
  );
  const cutoff = new Date(now.getTime() - BACKUP_DAYS * 86400000).toISOString().slice(0, 10);
  let removed = 0;
  for (const d of await db.listRaw("backups")) {
    if (docId(d.name).slice(0, 10) < cutoff) {
      await db.delete(`backups/${docId(d.name)}`);
      removed++;
    }
  }
  console.log(`backup listed: backups/${id}${removed ? ` · ${removed} expired entries removed` : ""}`);
}

main().catch((e) => {
  console.error(`backup not listed: ${e.message}`);
  process.exit(1);
});
