// Read the revenue and affiliate Google Sheets now, without a full sync
// (data-sync.yml mode "revenue-sheet", started from Import Revenue / Import
// Affiliate → "ดึงจาก Sheet ตอนนี้"). Writes only the drafts and status
// (lib/integrations/revenueSheet.ts, affiliateSheetsSync.ts); an admin imports
// them there. Never fails the job.
//
//   node scripts/revenue-sheet.mjs            read and save the drafts
//   node scripts/revenue-sheet.mjs --dry-run  read and print what is new; saves nothing
import fs from "node:fs";
import { Firestore, getAccessToken } from "../lib/integrations/firestoreRest.ts";
import { checkSheet, saveSheetCheck } from "../lib/integrations/revenueSheet.ts";
import { checkAffiliateSheets, saveAffiliateCheck } from "../lib/integrations/affiliateSheetsSync.ts";

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (fs.existsSync(".secrets/firebase-sync.json") && fs.readFileSync(".secrets/firebase-sync.json", "utf8"));
  if (!raw) return console.log("Sheets: no service account; skipped");
  const sa = JSON.parse(raw);
  const projectId = process.env.FIREBASE_PROJECT_ID || JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const db = new Firestore(projectId, await getAccessToken(sa));
  const check = await checkSheet(db, sa);
  console.log(`Revenue Sheet: ${check.status.ok ? check.status.detail : `not read (${check.status.error})`}`);
  const aff = await checkAffiliateSheets(db, sa);
  console.log(`Affiliate Sheets: ${aff.status.detail}${aff.status.error ? ` (${aff.status.error})` : ""} · ${aff.status.links.map((l) => (l.ok ? `${l.kind}${l.month ? ` ${l.month}` : ""}` : "✖")).join(", ")}`);
  if (process.argv.includes("--dry-run")) return;
  const runId = process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : "local";
  await saveSheetCheck(db, check, runId);
  await saveAffiliateCheck(db, aff, runId);
  console.log("Sheets: drafts and status saved");
}

main().catch((e) => console.log(`Sheets: not read (${e.message})`));
