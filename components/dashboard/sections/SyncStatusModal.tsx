"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, X, XCircle } from "lucide-react";
import { num } from "@/lib/dashboard/format";
import {
  SYNC_WORKFLOW_URL,
  isStale,
  loadSyncRuns,
  nextScheduledRun,
  type SyncRun,
  type SyncState,
  type SyncStatus,
} from "@/lib/sync/status";
import { track } from "@/lib/loadingBar";

const thTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "-";

const duration = (a?: string, b?: string) => {
  if (!a || !b) return "";
  const s = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000));
  return s < 60 ? `${s} วินาที` : `${Math.round(s / 60)} นาที`;
};

const STATE: Record<SyncState, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  success: { label: "สำเร็จ", tone: "ok", Icon: CheckCircle2 },
  blocked: { label: "ไม่เขียนข้อมูล (ไม่ผ่านการตรวจ)", tone: "warn", Icon: AlertTriangle },
  failed: { label: "ล้มเหลว", tone: "bad", Icon: XCircle },
};

const TRIGGER: Record<string, string> = { schedule: "อัตโนมัติ", manual: "สั่งรันเอง", local: "รันจากเครื่อง" };
const PLATFORMS = ["Facebook", "Instagram", "TikTok", "YouTube"];

export function SyncStatusModal({
  open,
  onClose,
  status,
}: {
  open: boolean;
  onClose: () => void;
  status: SyncStatus | null;
}) {
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [error, setError] = useState("");
  const [showChecks, setShowChecks] = useState(false);

  const refresh = () => {
    setRuns(null);
    setError("");
    track(loadSyncRuns(30))
      .then(setRuns)
      .catch(() => {
        setRuns([]);
        setError("โหลดประวัติการ sync ไม่สำเร็จ");
      });
  };
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;
  const latest = runs?.[0];
  const stale = isStale(status);
  const state = latest ? STATE[latest.status] : null;
  const warnings = latest?.checks.flatMap((c) => c.warnings || []) || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="source-modal sync-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
        <div className="sync-heading">
          <div className="modal-icon">
            <RefreshCw size={22} />
          </div>
          <div>
            <h2>สถานะการ Sync ข้อมูล</h2>
            <p>ดึงข้อมูลจาก Metricool และ YouTube อัตโนมัติทุกวันประมาณ 05:17 น. · รอบถัดไป {thTime(nextScheduledRun().toISOString())}</p>
          </div>
          <a className="sync-run-link" href={SYNC_WORKFLOW_URL} target="_blank" rel="noreferrer">
            รันตอนนี้ (GitHub Actions) <ExternalLink size={14} />
          </a>
        </div>

        {error && <p className="sync-error">{error}</p>}
        {runs === null && <p className="sync-muted">กำลังโหลด...</p>}
        {runs !== null && !latest && !error && <p className="sync-muted">ยังไม่มีการ sync ครั้งแรก</p>}

        {latest && state && (
          <>
            <div className={`sync-latest ${state.tone}`}>
              <state.Icon size={22} />
              <div>
                <strong>
                  {state.label} · {thTime(latest.finishedAt)} น.
                </strong>
                <span>
                  {TRIGGER[latest.trigger] || latest.trigger} · ใช้เวลา {duration(latest.startedAt, latest.finishedAt)} · ช่วงข้อมูล{" "}
                  {latest.window?.since} ถึง {latest.window?.until}
                </span>
                <span>{latest.message}</span>
                {latest.githubRunUrl && (
                  <a href={latest.githubRunUrl} target="_blank" rel="noreferrer">
                    ดูรายละเอียดใน GitHub <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            {stale && (
              <p className="sync-error">⚠️ ไม่มีการ sync เกิน 26 ชั่วโมง ตรวจสอบ GitHub Actions ว่ารอบอัตโนมัติยังทำงานอยู่</p>
            )}

            <h3>ความสดของข้อมูล</h3>
            <div className="sync-platforms">
              {PLATFORMS.map((p) => {
                const s = latest.platforms?.[p];
                return (
                  <div key={p} className={s ? (s.ok ? "ok" : "bad") : "none"} title={s?.error || ""}>
                    <b>{p}</b>
                    <span>{s ? (s.ok ? "✅ ดึงได้" : "❌ ดึงไม่ได้") : "–"}</span>
                    <small>{s?.latestPost ? `โพสต์ล่าสุด ${s.latestPost}` : s?.error ? s.error.slice(0, 60) : ""}</small>
                  </div>
                );
              })}
            </div>

            <h3>
              ผลตรวจความถูกต้อง {latest.checks.filter((c) => c.pass).length}/{latest.checks.length} ข้อ
              {warnings.length > 0 && <span className="sync-warn-count"> · คำเตือน {warnings.length}</span>}
              <button className="sync-toggle" onClick={() => setShowChecks((v) => !v)}>
                {showChecks ? "ซ่อน" : "ดูรายละเอียด"}
              </button>
            </h3>
            {showChecks && (
              <ul className="sync-checks">
                {latest.checks.map((c) => (
                  <li key={c.name} className={c.pass ? "ok" : "bad"}>
                    <b>{c.pass ? "✔" : "✖"}</b> {c.name} — {c.detail}
                    {c.warnings?.map((w) => (
                      <small key={w}>· {w}</small>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {runs && runs.length > 0 && (
          <>
            <h3>ประวัติ (30 รอบล่าสุด)</h3>
            <div className="table-scroll sync-history">
              <table>
                <thead>
                  <tr>
                    <th>เวลา</th>
                    <th>สถานะ</th>
                    <th>แบบ</th>
                    <th className="num">อัปเดต</th>
                    <th className="num">ใหม่</th>
                    <th className="num">รอตรวจ</th>
                    <th>ใช้เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.runId} title={r.message}>
                      <td>{thTime(r.startedAt)}</td>
                      <td className={`sync-state ${STATE[r.status]?.tone}`}>{STATE[r.status]?.label || r.status}</td>
                      <td>{TRIGGER[r.trigger] || r.trigger}</td>
                      <td className="num">{num(r.totals?.updated || 0)}</td>
                      <td className="num">{num(r.totals?.inserted || 0)}</td>
                      <td className="num">{num(r.totals?.needsReview || 0)}</td>
                      <td>{duration(r.startedAt, r.finishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
