"use client";
import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ExternalLink, Plus, Save, Trash2, X, XCircle } from "lucide-react";
import {
  SYNC_WORKFLOW_URL,
  loadNotificationConfig,
  saveNotificationConfig,
  type NotifyMode,
  type SyncStatus,
} from "@/lib/sync/status";

const MODES: { value: NotifyMode; label: string; hint: string }[] = [
  { value: "always", label: "ทุกรอบ (สรุปรายวัน)", hint: "ได้อีเมลทุกครั้งหลัง sync รู้ว่าระบบยังทำงานอยู่" },
  { value: "problems", label: "เฉพาะเมื่อมีปัญหา", hint: "ส่งเมื่อ sync ล้มเหลวหรือไม่ผ่านการตรวจ" },
  { value: "off", label: "ปิด", hint: "ไม่ส่งอีเมล" },
];

const validEmail = (e: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(e.trim());

const thTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "-";

/** Admins: who gets the email after each sync, and when. */
export function NotificationsModal({
  open,
  onClose,
  status,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  status: SyncStatus | null;
  userEmail: string;
}) {
  const [emails, setEmails] = useState<string[] | null>(null);
  const [mode, setMode] = useState<NotifyMode>("always");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmails(null);
    setMessage("");
    setError("");
    loadNotificationConfig()
      .then((c) => {
        setEmails(c.emails);
        setMode(c.mode);
      })
      .catch(() => {
        setEmails([]);
        setError("โหลดการตั้งค่าไม่สำเร็จ");
      });
  }, [open]);

  if (!open) return null;

  const add = () => {
    const e = draft.trim().toLowerCase();
    if (!validEmail(e) || !emails || emails.includes(e) || emails.length >= 10) return;
    setEmails([...emails, e]);
    setDraft("");
  };

  const save = async () => {
    if (!emails) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveNotificationConfig({ emails, mode }, userEmail);
      setMessage("บันทึกแล้ว · ใช้ตั้งแต่รอบ sync ถัดไป");
    } catch {
      setError("บันทึกไม่สำเร็จ (ต้องเป็น admin)");
    } finally {
      setSaving(false);
    }
  };

  const last = status?.notify;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="source-modal sync-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
        <div className="sync-heading">
          <div className="modal-icon">
            <Bell size={22} />
          </div>
          <div>
            <h2>การแจ้งเตือนทางอีเมล</h2>
            <p>สรุปผลการ sync อัตโนมัติ: สถานะ, จำนวนที่อัปเดต/ใหม่, ข้อมูล TV และการตรวจที่ไม่ผ่าน</p>
          </div>
        </div>

        {error && <p className="sync-error">{error}</p>}
        {emails === null ? (
          <p className="sync-muted">กำลังโหลด...</p>
        ) : (
          <>
            <h3>ผู้รับ (สูงสุด 10)</h3>
            {emails.length === 0 && <p className="sync-muted">ยังไม่มีผู้รับ</p>}
            <ul className="notify-list">
              {emails.map((e) => (
                <li key={e}>
                  {e}
                  <button className="tv-remove" onClick={() => setEmails(emails.filter((x) => x !== e))} aria-label="ลบ">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="notify-add">
              <input
                type="email"
                value={draft}
                placeholder="name@terodigital.com"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <button className="tv-add" onClick={add} disabled={!validEmail(draft) || emails.length >= 10}>
                <Plus size={15} /> เพิ่ม
              </button>
            </div>

            <h3>ส่งเมื่อไร</h3>
            <div className="notify-modes">
              {MODES.map((m) => (
                <label key={m.value} className={mode === m.value ? "active" : ""}>
                  <input type="radio" name="notify-mode" checked={mode === m.value} onChange={() => setMode(m.value)} />
                  <span>
                    <b>{m.label}</b>
                    <small>{m.hint}</small>
                  </span>
                </label>
              ))}
            </div>

            <h3>การส่งล่าสุด</h3>
            {last ? (
              <p className={last.ok ? "tv-ok" : "tv-bad"}>
                {last.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {thTime(last.at)} น. ·{" "}
                {last.ok ? `ส่งถึง ${last.to} คน` : `ส่งไม่สำเร็จ: ${last.error}`}
              </p>
            ) : (
              <p className="sync-muted">ยังไม่เคยส่ง</p>
            )}
            <p className="sync-muted tv-note">
              ส่งผ่าน Google Apps Script (ตั้งค่าครั้งเดียว ดู docs/SYNC_SETUP_TH.md) · ทดสอบได้ที่ GitHub Actions → Data sync → Run workflow → mode
              "test-email"
            </p>
          </>
        )}

        <div className="tv-actions">
          {message && <span className="tv-ok">{message}</span>}
          <a className="tv-add" href={SYNC_WORKFLOW_URL} target="_blank" rel="noreferrer">
            ส่งอีเมลทดสอบ (GitHub) <ExternalLink size={13} />
          </a>
          <button className="sync-run-link" onClick={save} disabled={saving || emails === null}>
            <Save size={14} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>
    </div>
  );
}
