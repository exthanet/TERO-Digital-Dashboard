"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileUp, Save, X, XCircle } from "lucide-react";
import { mergeTvEpisodes, parseTvSheet, type ParsedTvSheet } from "@/lib/integrations/tvSheet";
import {
  SYNC_WORKFLOW_URL,
  loadTvSources,
  loadTvUploadInfo,
  saveTvUpload,
  type TvSourceConfig,
} from "@/lib/sync/status";
import type { RawRow } from "@/lib/dashboard/types";

type Result = { source: TvSourceConfig; parsed?: ParsedTvSheet; error?: string };

const thTime = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "-";

/**
 * Admins: upload the TV rating workbook. Only the tabs set in "แหล่งข้อมูล TV"
 * are read (in the browser); the numbers are stored for the next sync, which
 * merges them into masterData with the usual backup and checks.
 */
export function TvUploadModal({
  open,
  onClose,
  rawRows,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  rawRows: RawRow[];
  userEmail: string;
}) {
  const [sources, setSources] = useState<TvSourceConfig[] | null>(null);
  const [previous, setPrevious] = useState<Awaited<ReturnType<typeof loadTvUploadInfo>>>({});
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setResults(null);
    setFileName("");
    setMessage("");
    setError("");
    Promise.all([loadTvSources(), loadTvUploadInfo()])
      .then(([s, p]) => {
        setSources(s.filter((x) => x.enabled));
        setPrevious(p);
      })
      .catch(() => {
        setSources([]);
        setError("โหลดการตั้งค่าไม่สำเร็จ");
      });
  }, [open]);

  if (!open) return null;

  const read = async (file: File) => {
    if (!sources?.length) return;
    setReading(true);
    setError("");
    setMessage("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      setResults(
        sources.map((source) => {
          const sheet = book.Sheets[source.sheet];
          if (!sheet) return { source, error: `ไม่พบแท็บ "${source.sheet}" ในไฟล์นี้` };
          const parsed = parseTvSheet(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][], source);
          if (parsed.missingColumns.length) return { source, error: `ไม่พบคอลัมน์: ${parsed.missingColumns.join(", ")}` };
          return { source, parsed };
        }),
      );
    } catch {
      setResults(null);
      setError("อ่านไฟล์ไม่ได้ (ต้องเป็นไฟล์ Excel .xlsx)");
    } finally {
      setReading(false);
    }
  };

  const ok = (results || []).filter((r) => r.parsed);
  const preview = ok.length ? mergeTvEpisodes(rawRows as Record<string, unknown>[], ok.flatMap((r) => r.parsed!.episodes)) : null;
  const revised = preview?.updated.filter((u) => "TV_Rating_Total" in u.before && u.before.TV_Rating_Total !== null && u.before.TV_Rating_Total !== "") || [];

  const save = async () => {
    if (!ok.length) return;
    setSaving(true);
    setError("");
    try {
      const uploadedAt = new Date().toISOString();
      for (const r of ok) {
        await saveTvUpload({
          sourceId: r.source.id,
          name: r.source.name,
          sheet: r.source.sheet,
          channel: r.source.channel,
          program: r.source.program,
          fileName,
          uploadedAt,
          uploadedBy: userEmail,
          episodes: r.parsed!.episodes as unknown as Record<string, unknown>[],
          competitors: r.parsed!.competitors as unknown as Record<string, unknown>[],
          pending: r.parsed!.pending,
          cancelled: r.parsed!.cancelled,
        });
      }
      setMessage(`บันทึกแล้ว ${ok.length} แท็บ · จะรวมเข้า masterData ในรอบ sync ถัดไป (06:00 น.) หรือกด "รันตอนนี้"`);
      setPrevious(await loadTvUploadInfo());
    } catch {
      setError("บันทึกไม่สำเร็จ (ต้องเป็น admin)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="source-modal sync-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
        <div className="sync-heading">
          <div className="modal-icon">
            <FileUp size={22} />
          </div>
          <div>
            <h2>อัปโหลดไฟล์ TV</h2>
            <p>ไฟล์ rating (.xlsx) · อ่านเฉพาะแท็บที่ตั้งไว้ในหน้า "แหล่งข้อมูล TV" แท็บอื่นในไฟล์ไม่ถูกส่งขึ้นระบบ</p>
          </div>
        </div>

        {error && <p className="sync-error">{error}</p>}
        {sources === null && <p className="sync-muted">กำลังโหลด...</p>}
        {sources?.length === 0 && <p className="sync-error">ยังไม่มีแหล่งข้อมูล TV ที่เปิดใช้ ตั้งค่าที่ เครื่องมือ admin → แหล่งข้อมูล TV ก่อน</p>}

        {!!sources?.length && (
          <>
            <div className="tv-upload-sources">
              {sources.map((s) => (
                <div key={s.id}>
                  <b>{s.name}</b> · แท็บ “{s.sheet}”
                  <small>
                    {previous[s.id]
                      ? `อัปโหลดล่าสุด ${thTime(previous[s.id].uploadedAt)} น. · ${previous[s.id].fileName} · ${previous[s.id].episodes} เทป · ${previous[s.id].uploadedBy}`
                      : "ยังไม่เคยอัปโหลด"}
                  </small>
                </div>
              ))}
            </div>
            <label className="tv-file">
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={reading || saving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void read(f);
                  e.target.value = "";
                }}
              />
              <FileUp size={16} /> {reading ? "กำลังอ่านไฟล์..." : fileName ? `เลือกไฟล์ใหม่ (ตอนนี้: ${fileName})` : "เลือกไฟล์ .xlsx"}
            </label>
          </>
        )}

        {results && (
          <>
            <h3>ผลการอ่านไฟล์</h3>
            <ul className="sync-checks">
              {results.map((r) => (
                <li key={r.source.id} className={r.parsed ? "ok" : "bad"}>
                  <b>{r.parsed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}</b> {r.source.name} —{" "}
                  {r.parsed
                    ? `${r.parsed.episodes.length} เทป · รอ rating ${r.parsed.pending.length} · งด ${r.parsed.cancelled.length} · คู่แข่ง ${r.parsed.competitors.length}`
                    : r.error}
                </li>
              ))}
            </ul>
            {preview && (
              <>
                <h3>เทียบกับข้อมูลปัจจุบัน</h3>
                <ul className="sync-checks">
                  <li className="ok">
                    เทปใหม่ {preview.inserted.length}
                    {preview.inserted.length > 0 && ` (${preview.inserted.map((r) => `${r.Date} ${r.Channel}`).slice(0, 8).join(", ")})`} · อัปเดตตัวเลข{" "}
                    {preview.updated.length} เทป · รวมแถวซ้ำ {preview.removed.length}
                  </li>
                  <li className={revised.length ? "bad" : "ok"}>
                    rating เดิมที่เปลี่ยนตามไฟล์ {revised.length} เทป
                    {revised.slice(0, 8).map((u) => (
                      <small key={u.key}>
                        · {u.key}: {String(u.before.TV_Rating_Total)} → {String(u.after.TV_Rating_Total)}
                      </small>
                    ))}
                  </li>
                  {preview.conflicts.length > 0 && (
                    <li className="bad">
                      rating ไม่ตรงกันระหว่างแถวซ้ำ {preview.conflicts.length} (ระบบจะไม่แก้ ให้คนตรวจ)
                    </li>
                  )}
                </ul>
              </>
            )}
          </>
        )}

        <div className="tv-actions">
          {message && <span className="tv-ok">{message}</span>}
          <a className="tv-add" href={SYNC_WORKFLOW_URL} target="_blank" rel="noreferrer">
            รันตอนนี้ (GitHub Actions) <ExternalLink size={13} />
          </a>
          <button className="sync-run-link" onClick={save} disabled={!ok.length || saving || reading}>
            <Save size={14} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>
    </div>
  );
}
