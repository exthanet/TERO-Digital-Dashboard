// Read the revenue Google Sheet now, without a full sync (data-sync.yml mode
// "revenue-sheet", started from Import Revenue → "ดึงจาก Sheet ตอนนี้"). Writes only
// the draft and status for Import Revenue (lib/integrations/revenueSheet.ts); the
// admin imports it there. Never fails the job.
//
//   node scripts/revenue-sheet.mjs            read and save the draft
//   node scripts/revenue-sheet.mjs --dry-run  read and print what is new; saves nothing
import fs from "node:fs";
import { Firestore, getAccessToken } from "../lib/integrations/firestoreRest.ts";
import { checkSheet, saveSheetCheck } from "../lib/integrations/revenueSheet.ts";

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) return console.log("Revenue Sheet: no service account; skipped");
  const sa = JSON.parse(raw);
  const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const db = new Firestore(projectId, await getAccessToken(sa));
  const check = await checkSheet(db, sa);
  const st = check.status;
  console.log(`Revenue Sheet: ${st.ok ? st.detail : `not read (${st.error})`}`);
  if (process.argv.includes("--dry-run")) return;
  await saveSheetCheck(db, check, process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : "local");
  console.log("Revenue Sheet: draft and status saved");
}

main().catch((e) => console.log(`Revenue Sheet: not read (${e.message})`));
