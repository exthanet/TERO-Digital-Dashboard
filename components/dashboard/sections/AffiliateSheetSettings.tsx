"use client";
// Import Affiliate → "นำเข้าจาก Google Sheet": the YouTube Studio Shopping exports
// kept in Google Sheets (any number of links: revenue by period, by product, by
// content; one month each or a longer period). The sync reads them into a draft
// only when an admin asks ("ดึงจาก Sheet ตอนนี้", lib/integrations/affiliateSheetsSync.ts),
// then checks it here and saves. It is not part of the daily sync.
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, FileSpreadsheet, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { auth, loadAffiliateSheets, saveAffiliateSheets } from "@/lib/firebase";
import { diffAffiliate, mergeAffiliate, withoutMonth, type AffiliateSheets } from "@/lib/dashboard/affiliateSheets";
import { SYNC_WORKFLOW_URL, loadAffiliateSheetSettings, saveAffiliateSheetLinks, type AffiliateSheetsStatus } from "@/lib/sync/status";

const isSheetLink = (url: string) => /^https:\/\/(?:docs|drive)\.google\.com\/(?:spreadsheets\/d|file\/d)\/[\w-]{20,}/.test(url.trim());
const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (m: string) => `${TH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const thDay = (d?: string) => (d ? `${Number(d.slice(8, 10))} ${thMonth(d.slice(0, 7))}` : "");
const thTime = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
const KIND: Record<string, string> = { period: "รายเดือน (revenue by period)", product: "รายสินค้า", content: "รายคลิป", unknown: "ไม่รู้จักรูปแบบ" };
const months = (list: string[]) => (list.length > 3 ? `${thMonth(list[0])} – ${thMonth(list[list.length - 1])} (${list.length} เดือน)` : list.map(thMonth).join(", "));

type Draft = AffiliateSheets & { readAt?: string };

export function AffiliateSheetSettings({ onSaved }: { onSaved?: () => void }) {
  const [links, setLinks] = useState<string[]>([""]);
  const [saved, setSaved] = useState<string[]>([]);
  const [status, setStatus] = useState<AffiliateSheetsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ draft: Draft; diff: ReturnType<typeof diffAffiliate>; kept: string[] } | null>(null);
  // What is stored now: its monthly product / clip exports can be taken out one by one.
  const [stored, setStored] = useState<Draft | null>(null);
  const loadStored = () => loadAffiliateSheets().then(setStored).catch(() => undefined);
  const [copied, setCopied] = useState(false);

  const load = () =>
    loadAffiliateSheetSettings()
      .then(({ links, status }) => {
        setLinks(links.length ? links : [""]);
        setSaved(links);
        setStatus(status);
      })
      .catch(() => setMsg({ ok: false, text: "โหลดการตั้งค่าไม่สำเร็จ" }));
  useEffect(() => {
    load();
    loadStored();
  }, []);

  const clean = links.map((l) => l.trim()).filter(Boolean);
  const dirty = JSON.stringify(clean) !== JSON.stringify(saved);

  const save = async () => {
    const bad = clean.find((l) => !isSheetLink(l));
    if (bad) return setMsg({ ok: false, text: "ทุกลิงก์ต้องเป็น Google Sheet (https://docs.google.com/spreadsheets/d/…)" });
    if (new Set(clean).size !== clean.length) return setMsg({ ok: false, text: "มีลิงก์ซ้ำ" });
    setBusy(true);
    setMsg(null);
    try {
      await saveAffiliateSheetLinks(clean, auth.currentUser?.email || "");
      setSaved(clean);
      setMsg({ ok: true, text: `บันทึก ${clean.length} ลิงก์แล้ว · กด "ดึงจาก Sheet ตอนนี้" เพื่ออ่าน` });
    } catch {
      setMsg({ ok: false, text: "บันทึกไม่สำเร็จ (ต้องเป็น admin)" });
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [draft, current] = await Promise.all([loadAffiliateSheets("affiliateSheetsDraft"), loadAffiliateSheets()]);
      if (!draft) return setMsg({ ok: false, text: "ยังไม่มีข้อมูลจาก Sheet · กด \"ดึงจาก Sheet ตอนนี้\" ก่อน" });
      // Merge: the links' months replace those months; every other stored month stays.
      const merged = mergeAffiliate(current, draft);
      // Monthly product / clip exports kept although no link carries them any more.
      const kept = current
        ? [...new Set([...Object.keys(current.productsByMonth || {}), ...Object.keys(current.contentsByMonth || {})])]
            .filter((m) => !draft.productsByMonth[m] && !draft.contentsByMonth[m])
            .sort()
        : [];
      setPreview({ draft: merged, diff: diffAffiliate(current, merged), kept });
    } catch {
      setMsg({ ok: false, text: "โหลดข้อมูลจาก Sheet ไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const importNow = async () => {
    if (!preview) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveAffiliateSheets(preview.draft);
      setPreview(null);
      setMsg({ ok: true, text: "นำเข้าแล้ว · Affiliate Dashboard ใช้ข้อมูลชุดนี้" });
      loadStored();
      onSaved?.();
    } catch {
      setMsg({ ok: false, text: "บันทึกไม่สำเร็จ (ต้องเป็น admin)" });
    } finally {
      setBusy(false);
    }
  };

  const removeMonth = async (m: string) => {
    if (!stored || !window.confirm(`ลบข้อมูลรายสินค้าและรายคลิปของ ${thMonth(m)} ออกจากระบบ? (ยอดรายเดือนจาก revenue by period ยังอยู่ · นำเข้าใหม่ได้จากลิงก์)`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await saveAffiliateSheets(withoutMonth(stored, m));
      setMsg({ ok: true, text: `ลบข้อมูลของ ${thMonth(m)} แล้ว` });
      loadStored();
      onSaved?.();
    } catch {
      setMsg({ ok: false, text: "ลบไม่สำเร็จ (ต้องเป็น admin)" });
    } finally {
      setBusy(false);
    }
  };
  const storedMonths = stored ? [...new Set([...Object.keys(stored.productsByMonth || {}), ...Object.keys(stored.contentsByMonth || {})])].sort() : [];

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

  const linkStatus = (url: string) => status?.links?.find((l) => l.url === url);
  const d = preview?.draft;

  return (
    <div className="rev-sheet aff-sheet">
      <h3>
        <FileSpreadsheet size={16} /> นำเข้าจาก Google Sheet
      </h3>
      <ol>
        <li>
          Export จากหน้า Shopping ใน YouTube Studio (รายเดือน · รายสินค้า · รายคลิป) ใส่ Google Sheet ไฟล์ละลิงก์ แล้ว Share ให้บัญชีระบบ สิทธิ์ <b>Viewer</b>
          {status?.shareWith && (
            <span className="rev-sheet-mail">
              <code>{status.shareWith}</code>
              <button type="button" onClick={copy} aria-label="คัดลอกอีเมล">
                <Copy size={12} /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
            </span>
          )}
        </li>
        <li>วางลิงก์ทั้งหมดด้านล่าง (ลำดับไม่สำคัญ · ไฟล์ที่วันที่ครบ 1 เดือนจะเป็นข้อมูลของเดือนนั้นเอง) แล้วกดบันทึก</li>
        <li>เมื่อเพิ่มลิงก์หรือแก้ Sheet: กด "ดึงจาก Sheet ตอนนี้" (เลือก mode <b>revenue-sheet</b> แล้ว Run workflow ~1 นาที) → "โหลดผลล่าสุด" → "ตรวจและนำเข้า"</li>
      </ol>

      <div className="aff-sheet-links">
        {links.map((l, i) => {
          const st = saved.includes(l.trim()) ? linkStatus(l.trim()) : undefined;
          return (
            <div key={i} className="aff-sheet-link">
              <div className="rev-sheet-row">
                <input
                  value={l}
                  onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  aria-label={`ลิงก์ที่ ${i + 1}`}
                />
                <button type="button" className="rev-sheet-clear" aria-label="ลบลิงก์นี้" onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [""])}>
                  <Trash2 size={13} />
                </button>
              </div>
              {st && (
                <small className={st.ok ? "rev-sheet-ok" : "rev-sheet-bad"}>
                  {st.ok
                    ? `${KIND[st.kind || "unknown"]}${st.metrics === "clicks" ? " (คลิก/impressions · ไม่มีค่าคอม)" : ""} · ${st.month ? thMonth(st.month) : st.from ? `${thDay(st.from)} – ${thDay(st.to)}` : `${st.rows} แถว`}${st.kind !== "period" ? ` · ${st.rows} แถว` : ""}`
                    : st.error}
                </small>
              )}
            </div>
          );
        })}
      </div>
      <div className="rev-sheet-row">
        <button type="button" className="rev-sheet-link" onClick={() => setLinks([...links, ""])}>
          <Plus size={13} /> เพิ่มลิงก์
        </button>
        <button type="button" className="rev-sheet-save" disabled={busy || !dirty} onClick={save}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : "บันทึกลิงก์"}
        </button>
      </div>
      {msg && <p className={msg.ok ? "rev-sheet-ok" : "rev-sheet-bad"}>{msg.text}</p>}

      {saved.length > 0 && (
        <div className="rev-sheet-draft">
          {status?.at ? (
            <p className={status.ok ? (/พร้อมนำเข้า/.test(status.detail) ? "rev-sheet-new" : "rev-sheet-ok") : "rev-sheet-bad"}>
              {status.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} ดึงจาก Sheet ล่าสุด {thTime(status.at)} น. · {status.detail}
              {status.error ? ` · ${status.error}` : ""}
            </p>
          ) : (
            <p className="rev-sheet-muted">ยังไม่ได้ดึงจาก Sheet</p>
          )}
          <div className="rev-sheet-row">
            <button type="button" className="rev-sheet-save" disabled={busy} onClick={check}>
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

      {storedMonths.length > 0 && (
        <div className="aff-sheet-stored">
          <small>ข้อมูลรายเดือน (สินค้า/คลิป) ที่อยู่ในระบบ:</small>
          {storedMonths.map((m) => (
            <span key={m}>
              {thMonth(m)}
              <small>
                {stored?.productsByMonth?.[m] ? "สินค้า" : ""}
                {stored?.productsByMonth?.[m] && stored?.contentsByMonth?.[m] ? " · " : ""}
                {stored?.contentsByMonth?.[m] ? "คลิป" : ""}
              </small>
              <button type="button" aria-label={`ลบข้อมูลของ ${thMonth(m)}`} disabled={busy} onClick={() => removeMonth(m)}>
                <Trash2 size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {preview && d && (
        <div className="aff-sheet-preview">
          <h4>ตรวจก่อนนำเข้า (ดึงเมื่อ {thTime(d.readAt)} น.)</h4>
          <ul>
            <li>รายเดือน: {d.monthly.length ? `${thMonth(d.monthly[0].month)} – ${thMonth(d.monthly[d.monthly.length - 1].month)} (${d.monthly.length} เดือน)` : "ไม่มี"}</li>
            <li>รายสินค้าแยกเดือน: {Object.keys(d.productsByMonth).length ? months(Object.keys(d.productsByMonth).sort()) : "ไม่มี"}</li>
            <li>รายคลิปแยกเดือน: {Object.keys(d.contentsByMonth).length ? months(Object.keys(d.contentsByMonth).sort()) : "ไม่มี"}</li>
            <li>
              ไฟล์รวม: สินค้า {d.products.length} · คลิป {d.contents.length}
              {d.productRange.from ? ` (${thDay(d.productRange.from)} – ${thDay(d.productRange.to)})` : ""}
            </li>
          </ul>
          <p className={preview.diff.any ? "rev-sheet-new" : "rev-sheet-ok"}>
            {preview.diff.any
              ? [
                  preview.diff.added.length ? `ใหม่: ${months(preview.diff.added)}` : "",
                  preview.diff.changed.length ? `ตัวเลขเปลี่ยน: ${months(preview.diff.changed)}` : "",
                  preview.diff.longChanged ? "ไฟล์รวมเปลี่ยน" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "เหมือนข้อมูลในระบบทุกอย่าง"}
          </p>
          <p className="rev-sheet-muted">
            นำเข้าแบบ Merge: เดือนที่อยู่ในลิงก์แทนข้อมูลเดิมของเดือนนั้น เดือนอื่นคงไว้ (ตัวเลขตาม Sheet ไม่มีการแก้)
            {preview.kept.length > 0 && ` · รายสินค้า/รายคลิปที่ไม่มีลิงก์แล้วแต่คงไว้: ${months(preview.kept)}`}
          </p>
          <div className="rev-sheet-row">
            <button type="button" className="rev-sheet-save" disabled={busy} onClick={importNow}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : "บันทึกขึ้นระบบ"}
            </button>
            <button type="button" className="rev-sheet-link" onClick={() => setPreview(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
