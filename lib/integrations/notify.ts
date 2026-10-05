// Email after each sync, sent through a small Google Apps Script web app
// (scripts/apps-script/notify.gs) so no mail password is stored anywhere.
// Env: NOTIFY_WEBHOOK_URL (the web app URL), NOTIFY_TOKEN (shared secret).
// Recipients and when to send come from Firestore syncConfig/notifications.
import type { RunReport } from "./syncWriter.ts";
import { BRAND } from "../brand.ts";

export type NotifyMode = "always" | "problems" | "off";

export const DASHBOARD_URL = "https://digital-dashboard.terodigital.com";

const STATUS_TH: Record<RunReport["status"], string> = {
  success: "สำเร็จ",
  blocked: "ไม่ได้เขียนข้อมูล (ไม่ผ่านการตรวจ)",
  failed: "ล้มเหลว",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

const thTime = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "-";

/** True when an optional source (YouTube Analytics…) did not work this run. */
export const integrationProblems = (report: Pick<RunReport, "integrations">) =>
  Object.entries(report.integrations || {}).filter(([, s]) => !s.ok);

export function shouldNotify(mode: NotifyMode, status: RunReport["status"], problems = false): boolean {
  if (mode === "off") return false;
  return mode === "always" || status !== "success" || problems;
}

/** Only plain, well-formed addresses; at most 10. */
export function cleanRecipients(emails: unknown): string[] {
  const list = Array.isArray(emails) ? emails : [];
  return [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(e)))].slice(0, 10);
}

export function buildEmail(report: RunReport, dashboardUrl = DASHBOARD_URL): { subject: string; html: string; text: string } {
  const problems = integrationProblems(report);
  const icon = report.status === "success" ? (problems.length ? "⚠️" : "✅") : report.status === "blocked" ? "⚠️" : "❌";
  const subject =
    report.runId === "test"
      ? `🧪 อีเมลทดสอบ TERO Dashboard · ${thTime(report.finishedAt || report.startedAt)}`
      : `${icon} TERO Dashboard sync ${STATUS_TH[report.status]}${problems.length ? ` · ${problems.map(([n]) => n).join(", ")} ใช้ไม่ได้` : ""} · ${thTime(report.finishedAt || report.startedAt)}`;
  const t = report.totals || {};
  const failed = (report.checks || []).filter((c) => !c.pass);
  const warnings = (report.checks || []).flatMap((c) => c.warnings || []).length;
  const platforms = Object.entries(report.platforms || {}).map(
    ([p, s]) => `${p}: ${s.ok ? "ดึงได้" : "ดึงไม่ได้"}${s.latestPost ? ` · โพสต์ล่าสุด ${s.latestPost}` : ""}${s.error ? ` · ${s.error}` : ""}`,
  );
  const integrations = Object.entries(report.integrations || {}).map(([n, s]) => `${n}: ${s.ok ? "✅" : "❌"} ${s.detail}${s.error ? ` · ${s.error}` : ""}`);
  const tv = (report.tvSources || []).map((s) =>
    s.ok ? `${s.name}: ${s.episodes} เทป${s.from ? ` (${s.from === "upload" ? "ไฟล์ที่อัปโหลด" : "SharePoint"})` : ""}` : `${s.name}: อ่านไม่ได้ · ${s.error}`,
  );
  const rows: [string, string][] = [
    ["สถานะ", `${icon} ${STATUS_TH[report.status]}`],
    ["เวลา", thTime(report.finishedAt || report.startedAt)],
    ["ช่วงข้อมูล", `${report.window?.since || "-"} ถึง ${report.window?.until || "-"}`],
    ["สรุป", report.message || "-"],
    ["อัปเดต / ใหม่", `${t.updated ?? 0} / ${t.inserted ?? 0} แถว`],
    ["TV", `อัปเดต ${t.tvUpdated ?? 0} เทป · ใหม่ ${t.tvInserted ?? 0}`],
    ["ผลตรวจ", `ผ่าน ${(report.checks || []).length - failed.length}/${(report.checks || []).length} ข้อ${warnings ? ` · คำเตือน ${warnings}` : ""}`],
  ];
  const list = (title: string, items: string[]) =>
    items.length ? `<h3 style="font-size:14px;margin:16px 0 6px">${esc(title)}</h3><ul style="margin:0;padding-left:18px">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  const html = `<div style="font-family:sans-serif;font-size:13px;color:#0f1b31;max-width:640px">
<h2 style="font-size:17px;margin:0 0 10px">${esc(subject)}</h2>
<table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border:1px solid #dce3ee;background:#f7f9fc;width:130px"><b>${esc(k)}</b></td><td style="padding:6px 10px;border:1px solid #dce3ee">${esc(v)}</td></tr>`)
    .join("")}</table>
${list("การตรวจที่ไม่ผ่าน", failed.map((c) => `${c.name} — ${c.detail}`))}
${list("แพลตฟอร์ม", platforms)}
${list("แหล่งข้อมูล TV", tv)}
${list("การเชื่อมต่อเสริม", integrations)}
<p style="margin-top:16px"><a href="${esc(dashboardUrl)}">เปิด dashboard</a>${report.githubRunUrl ? ` · <a href="${esc(report.githubRunUrl)}">ดูรายละเอียดใน GitHub</a>` : ""}</p>
<p style="color:#7b879a;font-size:11px">ส่งอัตโนมัติจากระบบ sync ของ ${BRAND.product} · เปลี่ยนผู้รับได้ที่ เครื่องมือ admin → การแจ้งเตือน</p>
</div>`;
  const text = [subject, ...rows.map(([k, v]) => `${k}: ${v}`), ...failed.map((c) => `ไม่ผ่าน: ${c.name} — ${c.detail}`), ...integrations, dashboardUrl].join("\n");
  return { subject, html, text };
}

/** POST to the Apps Script web app. Never throws: the result is reported. */
export async function sendEmail(
  webhookUrl: string,
  token: string,
  to: string[],
  mail: { subject: string; html: string; text: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" }, // Apps Script reads e.postData.contents
      body: JSON.stringify({ token, to, subject: mail.subject, html: mail.html, text: mail.text }),
      redirect: "follow",
    });
    const body = await res.text();
    let parsed: { ok?: boolean; error?: string } = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      /* not JSON: Apps Script error page */
    }
    if (!res.ok || !parsed.ok) return { ok: false, error: (parsed.error || `HTTP ${res.status}`).slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e).slice(0, 200) };
  }
}
