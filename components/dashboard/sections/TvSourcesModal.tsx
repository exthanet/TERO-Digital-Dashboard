"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Save, Trash2, Tv, X, XCircle } from "lucide-react";
import { loadTvSources, saveTvSources, type SyncStatus, type TvSourceConfig } from "@/lib/sync/status";
import { track } from "@/lib/loadingBar";

const PROGRAMS = ["ถกไม่เถียง", "เงินทองของจริง"];

const blankSource = (): TvSourceConfig => ({
  id: `tv-${Date.now().toString(36)}`,
  name: "",
  url: "",
  sheet: "",
  channel: "One31",
  program: "ถกไม่เถียง",
  enabled: true,
});

const isSharePoint = (url: string) => /^https:\/\/[\w-]+(-my)?\.sharepoint\.com\//i.test(url.trim());

/** Admins: which workbook tabs the daily sync reads TV ratings from. */
export function TvSourcesModal({
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
  const [sources, setSources] = useState<TvSourceConfig[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSources(null);
    setMessage("");
    setError("");
    track(loadTvSources())
      .then(setSources)
      .catch(() => {
        setSources([]);
        setError("โหลดการตั้งค่าไม่สำเร็จ");
      });
  }, [open]);

  if (!open) return null;

  const update = (id: string, patch: Partial<TvSourceConfig>) =>
    setSources((list) => (list || []).map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const problems = (s: TvSourceConfig) => [
    !s.name.trim() && "ใส่ชื่อ",
    !isSharePoint(s.url) && "ลิงก์ต้องเป็น SharePoint / OneDrive (https://….sharepoint.com/…)",
    !s.sheet.trim() && "ใส่ชื่อแท็บ",
  ].filter(Boolean) as string[];
  const invalid = (sources || []).some((s) => problems(s).length);

  const save = async () => {
    if (!sources || invalid) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const clean = sources.map((s) => ({ ...s, name: s.name.trim(), url: s.url.trim(), sheet: s.sheet.trim() }));
      await saveTvSources(clean, userEmail);
      setSources(clean);
      setMessage("บันทึกแล้ว · ใช้ในการ sync รอบถัดไป");
    } catch {
      setError("บันทึกไม่สำเร็จ (ต้องเป็น admin)");
    } finally {
      setSaving(false);
    }
  };

  const result = (id: string) => status?.tvSources?.find((t) => t.id === id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="source-modal sync-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="ปิด">
          <X size={18} />
        </button>
        <div className="sync-heading">
          <div className="modal-icon">
            <Tv size={22} />
          </div>
          <div>
            <h2>แหล่งข้อมูล TV</h2>
            <p>ไฟล์ rating ที่ระบบอ่านทุกวันพร้อม sync ประมาณ 05:17 น. แต่ละแถวคือ 1 แท็บของไฟล์ (1 รายการ × 1 ช่อง)</p>
          </div>
        </div>

        <p className="sync-muted tv-note">
          ระบบอ่าน rating รวมและ 4 เขต แล้วคำนวณ Audience = rating × 700,000 (One31 รวมใช้ Viewership ในไฟล์ถ้ามี) · คอลัมน์อื่นที่ทีมกรอกไม่ถูกแก้ ·
          ไฟล์ต้องอยู่ใน SharePoint ที่ผู้ดูแล Microsoft 365 ให้สิทธิ์แอป sync แล้ว
        </p>

        {error && <p className="sync-error">{error}</p>}
        {sources === null && <p className="sync-muted">กำลังโหลด...</p>}
        {sources?.length === 0 && <p className="sync-muted">ยังไม่มีแหล่งข้อมูล กด "เพิ่มแหล่งข้อมูล"</p>}

        {sources?.map((s) => {
          const r = result(s.id);
          const issues = problems(s);
          return (
            <div key={s.id} className={`tv-source ${s.enabled ? "" : "off"}`}>
              <div className="tv-source-grid">
                <label>
                  <span>ชื่อ</span>
                  <input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} placeholder="ถกไม่เถียง ONE31" />
                </label>
                <label>
                  <span>รายการ</span>
                  <select value={s.program} onChange={(e) => update(s.id, { program: e.target.value })}>
                    {[...new Set([...PROGRAMS, s.program])].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>ช่อง</span>
                  <select value={s.channel} onChange={(e) => update(s.id, { channel: e.target.value as TvSourceConfig["channel"] })}>
                    <option value="One31">One31</option>
                    <option value="GMM25">GMM25</option>
                  </select>
                </label>
                <label className="wide">
                  <span>ลิงก์ไฟล์ (SharePoint / OneDrive)</span>
                  <input value={s.url} onChange={(e) => update(s.id, { url: e.target.value })} placeholder="https://….sharepoint.com/…" />
                </label>
                <label>
                  <span>ชื่อแท็บ</span>
                  <input value={s.sheet} onChange={(e) => update(s.id, { sheet: e.target.value })} placeholder="ถกไม่เถียงONE-คู่แข่ง" />
                </label>
              </div>
              <div className="tv-source-foot">
                <label className="tv-toggle">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { enabled: e.target.checked })} />
                  เปิดใช้
                </label>
                {r ? (
                  <span className={r.ok ? "tv-ok" : "tv-bad"} title={r.error || ""}>
                    {r.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {r.ok
                      ? `รอบล่าสุด: ${r.episodes} เทป · รอ rating ${r.pending ?? 0} · งด ${r.cancelled ?? 0} · คู่แข่ง ${r.competitors ?? 0}`
                      : `รอบล่าสุดอ่านไม่ได้: ${r.error}`}
                  </span>
                ) : (
                  <span className="sync-muted">ยังไม่เคย sync</span>
                )}
                {issues.length > 0 && <span className="tv-bad">{issues.join(" · ")}</span>}
                <button className="tv-remove" onClick={() => setSources((list) => (list || []).filter((x) => x.id !== s.id))} aria-label="ลบ">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}

        <div className="tv-actions">
          <button className="tv-add" onClick={() => setSources((list) => [...(list || []), blankSource()])} disabled={sources === null}>
            <Plus size={15} /> เพิ่มแหล่งข้อมูล
          </button>
          {message && <span className="tv-ok">{message}</span>}
          <button className="sync-run-link" onClick={save} disabled={saving || invalid || sources === null}>
            <Save size={14} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </section>
    </div>
  );
}
