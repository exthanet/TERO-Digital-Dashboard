"use client";
// Import Revenue → "นำเข้าจาก Google Sheet": the link the "revenue-sheet" run reads into a draft
// (lib/integrations/revenueSheet.ts). Revenue comes from the CMS API every day;
// the sheet is imported here by an admin, in the same preview as a file, only when
// it has something to update. The sheet stays private: it is shared with the
// sync's service account as Viewer.
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, FileSpreadsheet, Loader2, XCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { RevenueWorkbook } from "@/lib/dashboard/revenueParser";
import { SYNC_WORKFLOW_URL, loadRevenueSheet, saveRevenueSheet, type RevenueSheetDraft, type RevenueSheetStatus } from "@/lib/sync/status";

/** Same check as the sync (lib/integrations/revenueSheet.ts sheetIdOf). */
const isSheetLink = (url: string) => /^https:\/\/(?:docs|drive)\.google\.com\/(?:spreadsheets\/d|file\/d)\/[\w-]{20,}/.test(url.trim());
const thTime = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";

export function RevenueSheetSettings({ onImport }: { onImport: (wb: RevenueWorkbook, source: string) => void }) {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<RevenueSheetStatus | null>(null);
  const [draft, setDraft] = useState<RevenueSheetDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () =>
    loadRevenueSheet()
      .then(({ config, status, draft }) => {
        setUrl(config?.url || "");
        setSaved(config?.url || "");
        setStatus(status);
        setDraft(draft);
      })
      .catch(() => setMsg({ ok: false, text: "โหลดการตั้งค่าไม่สำเร็จ" }));
  useEffect(() => {
    load();
  }, []);

  const save = async (next: string) => {
    const clean = next.trim();
    if (clean && !isSheetLink(clean)) {
      setMsg({ ok: false, text: "ลิงก์ต้องเป็น Google Sheet (https://docs.google.com/spreadsheets/d/…)" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await saveRevenueSheet(clean, auth.currentUser?.email || "");
      setSaved(clean);
      setUrl(clean);
      setMsg({ ok: true, text: clean ? "บันทึกลิงก์แล้ว · กด \"ดึงจาก Sheet ตอนนี้\" เพื่ออ่าน" : "ลบลิงก์แล้ว" });
    } catch {
      setMsg({ ok: false, text: "บันทึกไม่สำเร็จ (ต้องเป็น admin)" });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!status?.shareWith) return;
    try {
      await navigator.clipboard.writeText(status.shareWith);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the address stays selectable */
    }
  };

  const hasUpdate = !!(status?.ok && ((status.added?.length || 0) + (status.changed?.length || 0)));

  return (
    <div className="rev-sheet">
      <h3>
        <FileSpreadsheet size={16} /> นำเข้าจาก Google Sheet
      </h3>
      <p className="rev-sheet-lead">รายได้หลักดึงจาก YouTube CMS (API) ทุกวันอยู่แล้ว · ใช้ Sheet นำเข้าเองเมื่อมีข้อมูลสรุปที่จะอัปเดต (เช่น ยอดปิดเดือนแยกประเภท)</p>
      <ol>
        <li>
          เปิด Sheet → Share → ใส่อีเมลบัญชีระบบ สิทธิ์ <b>Viewer</b> (Sheet ยังเป็นส่วนตัว)
          {status?.shareWith ? (
            <span className="rev-sheet-mail">
              <code>{status.shareWith}</code>
              <button type="button" onClick={copy} aria-label="คัดลอกอีเมล">
                <Copy size={12} /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </span>
          ) : (
            <span className="rev-sheet-muted"> · อีเมลบัญชีระบบจะแสดงที่นี่หลังกด "ดึงจาก Sheet ตอนนี้" ครั้งแรก</span>
          )}
        </li>
        <li>วางลิงก์ Sheet แล้วกดบันทึก (ครั้งเดียว)</li>
        <li>
          เมื่อ Sheet มีข้อมูลใหม่: กด "ดึงจาก Sheet ตอนนี้" (เลือก mode <b>revenue-sheet</b> แล้ว Run workflow ใช้เวลา ~1 นาที) → "โหลดผลล่าสุด" → กด "ตรวจและนำเข้า" → ตรวจตัวเลขด้านล่าง → บันทึก
        </li>
      </ol>
      <div className="rev-sheet-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" aria-label="ลิงก์ Google Sheet" />
        <button type="button" className="rev-sheet-save" disabled={busy || url.trim() === saved} onClick={() => save(url)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : "บันทึก"}
        </button>
        {saved && (
          <button type="button" className="rev-sheet-clear" disabled={busy} onClick={() => save("")}>
            ลบลิงก์
          </button>
        )}
      </div>
      {msg && <p className={msg.ok ? "rev-sheet-ok" : "rev-sheet-bad"}>{msg.text}</p>}

      {saved && (
        <div className="rev-sheet-draft">
          {status?.at ? (
            <p className={status.ok ? (hasUpdate ? "rev-sheet-new" : "rev-sheet-ok") : "rev-sheet-bad"}>
              {status.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} ดึงจาก Sheet ล่าสุด {thTime(status.at)} น. · {status.ok ? status.detail : status.error || status.detail}
            </p>
          ) : (
            <p className="rev-sheet-muted">ยังไม่ได้ดึงจาก Sheet</p>
          )}
          <div className="rev-sheet-row">
            <button
              type="button"
              className="rev-sheet-save"
              disabled={!draft}
              title={draft ? "" : "ยังไม่มีข้อมูลจาก Sheet"}
              onClick={() => draft && onImport(draft, `จาก Google Sheet (ดึงเมื่อ ${thTime(draft.readAt)} น.) `)}
            >
              ตรวจและนำเข้า
            </button>
            <a className="rev-sheet-link" href={SYNC_WORKFLOW_URL} target="_blank" rel="noreferrer">
              ดึงจาก Sheet ตอนนี้ <ExternalLink size={12} />
            </a>
            <button type="button" className="rev-sheet-link" onClick={load}>
              โหลดผลล่าสุด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
