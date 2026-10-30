"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GitFork, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { loadProgramSplits } from "@/lib/sync/status";
import { applyProgramSplitsToFirebase } from "@/lib/firebase";
import { planProgramSplits, type ProgramSplit, type SplitMoved } from "@/lib/dashboard/programSplits";
import { rowKey } from "@/lib/dashboard/postKey";
import type { RawRow } from "@/lib/dashboard/types";
import { track } from "@/lib/loadingBar";

/** A rule as edited: keywords typed as one line. */
type Draft = Omit<ProgramSplit, "keywords"> & { keywordsText: string };

const PLATFORMS = ["YouTube", "TikTok", "Facebook", "Instagram"];
const toDraft = (r: ProgramSplit): Draft => ({ ...r, keywordsText: r.keywords.join(", ") });
const toRule = (d: Draft): ProgramSplit => ({
  id: d.id,
  name: d.name.trim(),
  parent: d.parent.trim(),
  keywords: d.keywordsText.split(/[,，\n]/).map((k) => k.trim()).filter(Boolean),
  enabled: d.enabled,
});
const blank = (parent: string): Draft => ({ id: `split-${Date.now().toString(36)}`, name: "", parent, keywordsText: "", enabled: true });
const n = (v: number) => v.toLocaleString("en-US");

/** Admins: move a sub-show's clips out of its program (ถกใจคนค้นหมาป่า out of ถกไม่เถียง). */
export function ProgramSplitsModal({
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
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [moved, setMoved] = useState<SplitMoved>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDrafts(null);
    setDone("");
    setError("");
    track(loadProgramSplits())
      .then((s) => {
        setDrafts(s.rules.map(toDraft));
        setMoved(s.moved);
      })
      .catch(() => {
        setDrafts([]);
        setError("โหลดการตั้งค่าไม่สำเร็จ");
      });
  }, [open]);

  // Online programs, most rows first: what a rule can split from.
  const programs = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of rawRows) if (r.Platform !== "TV" && r.Program) count.set(String(r.Program), (count.get(String(r.Program)) || 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [rawRows]);

  const rules = useMemo(() => (drafts || []).map(toRule), [drafts]);
  // On the page's copy: the numbers to expect. Saving runs the same plan on masterData itself.
  const plan = useMemo(() => (drafts ? planProgramSplits(rawRows, rules, moved, rowKey) : null), [drafts, rawRows, rules, moved]);

  if (!open) return null;

  const update = (id: string, patch: Partial<Draft>) => setDrafts((list) => (list || []).map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const shift = (i: number, by: number) =>
    setDrafts((list) => {
      const next = [...(list || [])];
      const j = i + by;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const problems = (d: Draft) => {
    const r = toRule(d);
    return [
      !r.name && "ใส่ชื่อรายการย่อย",
      r.name && r.name === r.parent && "ชื่อต้องไม่ซ้ำกับรายการแม่",
      !r.keywords.length && "ใส่คำที่ใช้จับอย่างน้อย 1 คำ",
      r.keywords.some((k) => k.replace(/\s+/g, "").length < 3) && "คำที่ใช้จับสั้นเกินไป (อย่างน้อย 3 ตัวอักษร)",
      rules.filter((x) => x.name && x.name === r.name).length > 1 && "ชื่อนี้มีกฎอื่นใช้แล้ว",
    ].filter(Boolean) as string[];
  };
  const invalid = (drafts || []).some((d) => problems(d).length);

  const changes = plan?.changes || [];
  const ruleOf = (to: string) => rules.find((r) => r.name === to);
  const perRule = rules.map((r) => {
    const mv = changes.filter((c) => c.kind === "move" && c.to === r.name);
    const back = changes.filter((c) => c.kind === "back" && c.from === r.name).length;
    const byPlatform = PLATFORMS.map((p) => [p, mv.filter((c) => rawRows[c.index].Platform === p).length] as const);
    const systemKeys = new Set(plan?.moved[r.id]?.keys || []);
    const team = r.name ? rawRows.filter((row) => row.Program === r.name && !systemKeys.has(rowKey(row))).length : 0;
    return { id: r.id, move: mv.length, back, byPlatform, team, kept: systemKeys.size - mv.length };
  });
  const backFromRemoved = changes.filter((c) => c.kind === "back" && !ruleOf(c.from)).length;
  const list = [...changes].sort((a, b) => String(rawRows[b.index].Date).localeCompare(String(rawRows[a.index].Date)));
  const shown = showAll ? list : list.slice(0, 20);

  const save = async () => {
    if (!drafts || invalid) return;
    if (changes.length && !window.confirm(`เปลี่ยน Program ${n(changes.length)} แถวใน masterData ตอนนี้?`)) return;
    setSaving(true);
    setError("");
    setDone("");
    try {
      const r = await track(applyProgramSplitsToFirebase(rules, userEmail));
      setDone(`บันทึกแล้ว · ย้าย ${n(r.moved)} แถว${r.back ? ` · คืนรายการแม่ ${n(r.back)} แถว` : ""} · โหลดหน้าใหม่เพื่อดูผล`);
      const s = await loadProgramSplits();
      setMoved(s.moved);
    } catch {
      setError("บันทึกไม่สำเร็จ (ต้องเป็น admin) ข้อมูลที่ยังไม่ได้เขียนจะถูกจัดให้ในรอบ sync ถัดไป");
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
            <GitFork size={22} />
          </div>
          <div>
            <h2>แยกรายการย่อย</h2>
            <p>คลิปของรายการแม่ที่ชื่อคลิปหรือแฮชแท็กมีคำที่กำหนด จะย้ายไปเป็นรายการย่อย · sync ทุกวันจัดให้ต่ออัตโนมัติ</p>
          </div>
        </div>

        <p className="sync-muted tv-note">
          ไม่สนช่องว่างและตัวพิมพ์เล็ก-ใหญ่ · ย้ายเฉพาะแถวที่ Program เป็นรายการแม่ (PROMO และรายการอื่นไม่ถูกแตะ) · ถ้าตรงหลายกฎ กฎบนสุดชนะ ·
          ปิดหรือลบกฎ: คืนรายการแม่เฉพาะแถวที่ระบบย้าย แถวที่ทีมกรอกเองไม่ถูกแตะ · รายงานบัญชี (Monthly ACC) ยังนับรวมในบรรทัดรายการแม่
        </p>

        {error && <p className="sync-error">{error}</p>}
        {drafts === null && <p className="sync-muted">กำลังโหลด...</p>}
        {drafts?.length === 0 && <p className="sync-muted">ยังไม่มีกฎ กด "เพิ่มกฎ"</p>}

        {drafts?.map((d, i) => {
          const issues = problems(d);
          const s = perRule[i];
          return (
            <div key={d.id} className={`tv-source ${d.enabled ? "" : "off"}`}>
              <div className="tv-source-grid split-grid">
                <label>
                  <span>ชื่อรายการย่อย</span>
                  <input value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} placeholder="ถกใจคนค้นหมาป่า" />
                </label>
                <label>
                  <span>แยกออกจาก</span>
                  <select value={d.parent} onChange={(e) => update(d.id, { parent: e.target.value })}>
                    {[...new Set([d.parent, ...programs])].filter(Boolean).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  <span>คำที่ใช้จับ (คั่นด้วย ,)</span>
                  <input value={d.keywordsText} onChange={(e) => update(d.id, { keywordsText: e.target.value })} placeholder="ถกใจคนค้นหมาป่า, WereWolf" />
                </label>
              </div>
              <div className="tv-source-foot">
                <label className="tv-toggle">
                  <input type="checkbox" checked={d.enabled} onChange={(e) => update(d.id, { enabled: e.target.checked })} />
                  เปิดใช้
                </label>
                {issues.length > 0 ? (
                  <span className="tv-bad">{issues.join(" · ")}</span>
                ) : (
                  <span className="sync-muted">
                    {s.move ? `จะย้าย ${n(s.move)} แถว (${s.byPlatform.filter(([, c]) => c).map(([p, c]) => `${p} ${n(c)}`).join(" · ")})` : "ไม่มีแถวต้องย้ายเพิ่ม"}
                    {s.back ? ` · คืน${d.parent} ${n(s.back)} แถว` : ""}
                    {s.kept > 0 ? ` · ระบบย้ายไว้แล้ว ${n(s.kept)} แถว` : ""}
                    {s.team > 0 ? ` · ทีมกรอกเอง ${n(s.team)} แถว (ไม่แตะ)` : ""}
                  </span>
                )}
                <span className="split-order">
                  <button onClick={() => shift(i, -1)} aria-label="เลื่อนขึ้น" disabled={i === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button onClick={() => shift(i, 1)} aria-label="เลื่อนลง" disabled={i === drafts.length - 1}>
                    <ArrowDown size={14} />
                  </button>
                </span>
                <button className="tv-remove" onClick={() => setDrafts((all) => (all || []).filter((x) => x.id !== d.id))} aria-label="ลบ">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}

        {backFromRemoved > 0 && <p className="sync-muted">กฎที่ลบ: คืนรายการแม่ {n(backFromRemoved)} แถว</p>}

        {list.length > 0 && (
          <div className="split-preview">
            <p>
              ตัวอย่างก่อนจัดกลุ่ม · {n(list.length)} แถว
            </p>
            <table>
              <thead>
                <tr>
                  <th>แพลตฟอร์ม</th>
                  <th>วันที่</th>
                  <th>ชื่อคลิป</th>
                  <th>เปลี่ยนเป็น</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const r = rawRows[c.index];
                  return (
                    <tr key={`${c.index}-${c.kind}`}>
                      <td>{String(r.Platform)}</td>
                      <td>{String(r.Date).slice(0, 10)}</td>
                      <td title={String(r.Topic || "")}>{String(r.Topic || "").replace(/\s+/g, " ")}</td>
                      <td className={c.kind === "back" ? "tv-bad" : ""}>{c.to}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.length > shown.length && (
              <button className="tv-add" onClick={() => setShowAll(true)}>
                ดูทั้งหมด {n(list.length)} แถว
              </button>
            )}
          </div>
        )}

        <div className="tv-actions">
          <button className="tv-add" onClick={() => setDrafts((all) => [...(all || []), blank(programs[0] || "")])} disabled={drafts === null}>
            <Plus size={15} /> เพิ่มกฎ
          </button>
          {done && (
            <span className="tv-ok">
              {done}{" "}
              <button className="tv-add" onClick={() => window.location.reload()}>
                <RefreshCw size={13} /> โหลดหน้าใหม่
              </button>
            </span>
          )}
          <button className="sync-run-link" onClick={save} disabled={saving || invalid || drafts === null}>
            <Save size={14} /> {saving ? "กำลังบันทึก..." : changes.length ? `บันทึกและจัดกลุ่ม ${n(changes.length)} แถว` : "บันทึก"}
          </button>
        </div>
      </section>
    </div>
  );
}
