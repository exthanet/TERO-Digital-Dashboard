// Telegram message after a sync job, or a test message. Never fails the job:
// a missing setting or a Telegram problem is printed and the script exits 0.
//
//   node scripts/notify-telegram.mjs --sync    (data-sync.yml: JOB_STATUS, RUN_URL, MODE, FIREBASE_SERVICE_ACCOUNT)
//   node scripts/notify-telegram.mjs --test    a test message
//
// Settings: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, or .secrets/telegram.json {"token": "...", "chatId": "..."}.
import fs from "node:fs";
import { decodeFields } from "../lib/integrations/firestoreRest.ts";
import { sendTelegram, syncMessage } from "../lib/integrations/telegram.ts";

/** Bot token and chat id from the environment or .secrets/telegram.json; null when not set up. */
export function telegramTarget() {
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) return { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID };
  try {
    const x = JSON.parse(fs.readFileSync(".secrets/telegram.json", "utf8"));
    return x.token && x.chatId ? { token: String(x.token), chatId: String(x.chatId) } : null;
  } catch {
    return null;
  }
}

/** This job's run report: syncStatus/latest → syncRuns/{runId}, only if it names this GitHub run. */
async function thisRunReport(runUrl) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !fs.existsSync(".secrets/firebase-sync.json")) return null;
  const { connect } = await import("./backup-export.mjs");
  const { db } = await connect();
  const latest = await db.get("syncStatus/latest");
  const runId = latest && decodeFields(latest.fields || {}).runId;
  if (!runId) return null;
  const doc = await db.get(`syncRuns/${runId}`);
  const report = doc ? decodeFields(doc.fields || {}) : null;
  return report && (!runUrl || report.githubRunUrl === runUrl) ? report : null;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const target = telegramTarget();
  if (!target) {
    console.log("Telegram: not set up (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID); skipped");
    return;
  }
  let text;
  if (args.has("--test")) {
    text = `🧪 ทดสอบแจ้งเตือนจาก TERO Media Insights${process.env.RUN_URL ? `\n${process.env.RUN_URL}` : ""}`;
  } else {
    const runUrl = process.env.RUN_URL || "";
    const report = await thisRunReport(runUrl).catch((e) => {
      console.log(`Telegram: run report not read (${e.message})`);
      return null;
    });
    text = syncMessage(report, { jobStatus: process.env.JOB_STATUS || "success", runUrl, mode: process.env.MODE || "write" });
  }
  const problem = await sendTelegram(target, text);
  console.log(problem ? `Telegram: ${problem}` : "Telegram: sent");
}

if (process.argv[1]?.endsWith("notify-telegram.mjs")) {
  main().catch((e) => console.log(`Telegram: not sent (${e.message})`));
}
