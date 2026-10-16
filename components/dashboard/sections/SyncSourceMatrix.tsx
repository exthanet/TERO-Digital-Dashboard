"use client";
// สถานะการ Sync → "แหล่งข้อมูลแต่ละบัญชี": which account is read straight from the
// platform's API and which still through Metricool (lib/sync/sourceMatrix.ts).
import { useState } from "react";
import { Info } from "lucide-react";
import { MATRIX_PLATFORMS, sourceMatrix } from "@/lib/sync/sourceMatrix";
import type { SyncRun } from "@/lib/sync/status";
import { SyncApiHelp } from "./SyncApiHelp";

/** Where a TV tab was read from (scripts/metricool-sync.mjs tvStep). */
const TV_FROM: Record<string, string> = {
  link: "อ่านจากลิงก์ SharePoint ทุกรอบ (ไม่ต้องอัปโหลด)",
  sharepoint: "อ่านผ่าน Microsoft Graph ทุกรอบ",
  upload: "ใช้ไฟล์ที่อัปโหลด (ยังไม่ได้อ่านจากลิงก์)",
  file: "ไฟล์ในเครื่อง",
};

export function SyncSourceMatrix({ run }: { run: SyncRun }) {
  const [help, setHelp] = useState(false);
  const m = sourceMatrix(run.sources);
  if (!m) return null;
  const notApi = (k: string) => k !== "api" && k !== "none";
  const tiktokLeft = m.rows.filter((r) => notApi(r.cells.TikTok.kind)).map((r) => r.brand);
  const metaLeft = m.rows.filter((r) => notApi(r.cells.Facebook.kind) || notApi(r.cells.Instagram.kind)).map((r) => r.brand);
  const parts = MATRIX_PLATFORMS.filter((p) => m.notOnApi[p]).map((p) => `${p} ${m.notOnApi[p]}`);
  const tvFrom = [...new Set((run.tvSources || []).filter((s) => s.ok).map((s) => s.from || ""))];
  return (
    <>
      <h3>
        แหล่งข้อมูลแต่ละบัญชี
        <button type="button" className="ssm-info" onClick={() => setHelp(true)} aria-label="วิธีเชื่อม API ตรงกับแพลตฟอร์ม" title="วิธีเชื่อม API ตรงกับแพลตฟอร์ม">
          <Info size={15} />
        </button>
      </h3>
      {help && <SyncApiHelp onClose={() => setHelp(false)} tiktok={tiktokLeft} meta={metaLeft} analytics={m.noAnalytics} />}
      {m.notOnApiTotal > 0 ? (
        <p className="ssm-summary">
          ยังไม่ได้ต่อ API {m.notOnApiTotal} ช่อง ยังดึงผ่าน Metricool (บางวันข้อมูลมาช้า 1 วัน) · {parts.join(" · ")}
        </p>
      ) : (
        <p className="ssm-summary ok">ทุกบัญชีดึงผ่าน API ตรงแล้ว</p>
      )}
      <div className="table-scroll">
        <table className="ssm-table">
          <thead>
            <tr>
              <th>บัญชี</th>
              {MATRIX_PLATFORMS.map((p) => (
                <th key={p}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.brand}>
                <td>{r.brand}</td>
                {MATRIX_PLATFORMS.map((p) => {
                  const c = r.cells[p];
                  if (c.kind === "none") return <td key={p} className="ssm-none">–</td>;
                  return (
                    <td key={p} title={c.error || ""}>
                      <span className={`ssm-pill ${c.kind}`}>{c.label}</span>
                      {c.note && <small>{c.note}</small>}
                      {c.error && c.kind !== "metricool" && <small className="ssm-err">{c.error.slice(0, 80)}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sync-note">
        <span className="ssm-pill api">API</span> ดึงตรงจากแพลตฟอร์ม · <span className="ssm-pill metricool">Metricool</span> ยังไม่ได้ต่อ API ·{" "}
        <span className="ssm-pill fallback">API ใช้ไม่ได้</span> ต่อแล้วแต่รอบนี้ใช้ไม่ได้ · – ไม่มีบัญชีนี้
        <br />
        กด <Info size={11} className="ssm-note-icon" /> ข้างหัวข้อเพื่อดูวิธีเชื่อม API
      </p>

      <h4 className="ssm-sub">ข้อมูลอื่น</h4>
      <div className="table-scroll">
        <table className="ssm-table ssm-other">
          <tbody>
            <tr>
              <td>TV Rating</td>
              <td>
                {tvFrom.length ? (
                  tvFrom.map((f) => (
                    <span key={f} className={f === "upload" || f === "file" ? "ssm-pill metricool" : ""}>
                      {TV_FROM[f] || "อ่านได้"}
                    </span>
                  ))
                ) : (
                  <span className="ssm-pill error">รอบนี้อ่านไม่ได้</span>
                )}
              </td>
            </tr>
            <tr>
              <td>Revenue / Affiliate</td>
              <td>
                <span className="ssm-pill metricool">นำเข้าไฟล์</span> ตามที่ตกลงไว้ ยังไม่ดึงผ่าน API
              </td>
            </tr>
            <tr>
              <td>Monthly ACC</td>
              <td>brainchild tv3, Tero Performance course ไม่อยู่ใน CMS ที่เชื่อมไว้</td>
            </tr>
            <tr>
              <td>YouTube Analytics</td>
              <td>
                {m.hasAnalytics.length ? `เปิดเฉพาะช่อง ${m.hasAnalytics.join(", ")}` : "ยังไม่ได้เปิด"}
                {m.noAnalytics.length > 0 && ` · ${m.noAnalytics.join(", ")} ยังไม่เปิด`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
