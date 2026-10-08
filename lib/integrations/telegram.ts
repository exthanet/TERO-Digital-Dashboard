// Telegram alerts: every sync run (data-sync.yml → scripts/notify-telegram.mjs)
// and a failed local backup (scripts/backup-local.mjs). Plain text, no markup,
// so titles with any characters are safe. A Telegram problem never fails a run.
//
// The bot token and chat id come from GitHub Secrets (TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_ID) or, on the office PC, .secrets/telegram.json. The token is
// never printed: errors carry Telegram's description only.
import type { RunReport } from "./syncWriter.ts";

export interface TelegramTarget {
  token: string;
  chatId: string;
}

/** Send one message. Returns "" when sent, otherwise why not. */
export async function sendTelegram(target: TelegramTarget, text: string, fetcher: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetcher(`https://api.telegram.org/bot${target.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: target.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return res.ok && body.ok ? "" : `Telegram ${res.status}: ${body.description || "ส่งไม่สำเร็จ"}`;
  } catch (e) {
    return `Telegram: ${e instanceof Error ? e.name : "error"}`;
  }
}

const n = (v: unknown) => Number(v || 0).toLocaleString("en-US");
const minutes = (sec: number) => (sec < 90 ? `${sec} วินาที` : `${Math.round(sec / 60)} นาที`);
/** Bangkok date and time, e.g. "9 ต.ค. 05:42". */
export function bangkokTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600000);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * The message for one sync job. `report` = this job's run report (null when the
 * job stopped before writing one). `jobStatus` = GitHub's job.status.
 */
export function syncMessage(
  report: Partial<RunReport> | null,
  opts: { jobStatus: string; runUrl: string; mode?: string },
): string {
  const link = opts.runUrl ? `\n${opts.runUrl}` : "";
  const test = opts.mode === "test-run" ? " (ตรวจอย่างเดียว ไม่เขียน)" : "";
  const timings = report?.timings || [];
  const total = timings.reduce((a, t) => a + (t.sec || 0), 0);
  const slowest = [...timings].sort((a, b) => b.sec - a.sec).slice(0, 2).map((t) => `${t.step} ${minutes(t.sec)}`).join(", ");
  const time = total ? ` · ${minutes(total)}${slowest ? ` (นานสุด: ${slowest})` : ""}` : "";
  const when = report?.startedAt ? bangkokTime(report.startedAt) : "";
  const t = report?.totals || {};

  if (opts.jobStatus === "cancelled") {
    const written = report?.status === "success" ? "\nเขียนข้อมูลเสร็จแล้วก่อนถูกหยุด ข้อมูลใน dashboard เป็นของรอบนี้" : "\nยังไม่ได้เขียนข้อมูล dashboard ยังเป็นข้อมูลรอบก่อน";
    return `⚠️ Data sync เกินเวลา ถูกหยุด${test}${when ? ` · ${when}` : ""}${written}${link}`;
  }
  // A test run writes no report: the job's own outcome is the result.
  if (opts.mode === "test-run") {
    return opts.jobStatus === "success" ? `🧪 Data sync test-run ผ่านการตรวจ (ไม่ได้เขียนข้อมูล)${link}` : `⚠️ Data sync test-run ไม่ผ่าน (ไม่ได้เขียนข้อมูล)${link}`;
  }
  if (!report) {
    return `⚠️ Data sync ไม่สำเร็จ${test} ก่อนบันทึกรายงาน (ข้อมูลเดิมไม่ถูกแตะ)${link}`;
  }
  if (report.status === "success" && opts.jobStatus === "success") {
    const tv = t.tvUpdated || t.tvInserted ? ` · TV ${n(t.tvUpdated)} เทป` : "";
    const problems = Object.entries(report.platforms || {}).filter(([, p]) => p && !p.ok).map(([k]) => k);
    const integrations = Object.entries(report.integrations || {}).filter(([, s]) => s && !s.ok).map(([k]) => k);
    const warn = [...problems, ...integrations].length ? `\nควรดู: ${[...problems, ...integrations].join(", ")}` : "";
    return `✅ Data sync ${when}${test}\nอัปเดต ${n(t.updated)} · ใหม่ ${n(t.inserted)} · รวม ${n(t.rowsAfter)} แถว${tv}${time}${warn}${link}`;
  }
  const why = report.message || (report.status === "blocked" ? "ไม่ผ่านการตรวจ จึงไม่ได้เขียนข้อมูล" : "ไม่สำเร็จ");
  return `⚠️ Data sync ${report.status === "blocked" ? "ไม่ผ่านการตรวจ" : "ไม่สำเร็จ"}${test}${when ? ` · ${when}` : ""}\n${why}${time}${link}`;
}
