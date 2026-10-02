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
import { track } from "@/lib/loadingBar";
import { LoadingLine } from "@/components/dashboard/shared/LoadingLine";

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
    track(Promise.all([loadTvSources(), loadTvUploadInfo()]))
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
    const uploadedAt = new Date().toISOString();
    let current = "";
    let saved = 0;
    try {
      for (const r of ok) {
        current = r.source.name;
        // Firestore stores at most 1 MiB per document: say so before trying.
        const size = new Blob([JSON.stringify({ episodes: r.parsed!.episodes, competitors: r.parsed!.competitors })]).size;
        if (size > 1_000_000) {
          throw new Error(`ข้อมูลแท็บนี้ใหญ่ ${Math.round(size / 1024)} KB เกินขีดจำกัด 1 MB ของระบบ (ส่วนใหญ่เป็นตารางคู่แข่ง) แจ้งผู้ดูแลระบบ`);
        }
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
        saved++;
      }
      setMessage(
        `บันทึกแล้ว ${ok.length} แท็บ · ข้อมูลจะขึ้นใน dashboard หลัง sync แบบเขียนจริงรอบถัดไป (ทุกวันประมาณ 05:17 น.) · ถ้าต้องการทันที กด "รันตอนนี้" แล้วเลือก mode = write (แบบ test-run จะไม่รวมข้อมูล)`,
      );
      setPrevious(await track(loadTvUploadInfo()));
    } catch (e) {
      const code = (e as { code?: string }).code || "";
      const text = String((e as Error)?.message || e);
      setError(
        `บันทึก${current ? ` "${current}"` : ""}ไม่สำเร็จ: ${
          code === "permission-denied"
            ? "ไม่มีสิทธิ์ หรือข้อมูลไม่ผ่านเงื่อนไขของระบบ (ต้องเป็น admin และไม่เกิน 2,000 เทปต่อแท็บ)"
            : /maximum|exceeds|too large|size/i.test(text)
              ? "ข้อมูลใหญ่เกินขีดจำกัด 1 MB ของระบบ แจ้งผู้ดูแลระบบ"
              : code === "unavailable"
                ? "เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่"
                : text.slice(0, 160)
        }${saved ? ` · ${saved} แท็บก่อนหน้าบันทึกแล้ว` : ""}`,
      );
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
        {sources === null && <p className="sync-muted">กำลังโหลด...<LoadingLine /></p>}
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
            รันตอนนี้ (GitHub Actions · เลือก write) <ExternalLink size={13} />
          </a>
          <button className="sync-run-link" onClick={save} disabled={!ok.length || saving || reading}>
            <Save size={14} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>
    </div>
  );
}
