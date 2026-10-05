"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MonthlyRevenueItem,
  RevenueData,
  parseRevenueWorkbook,
} from "@/lib/dashboard/revenueParser";
import { COMPANY_LABEL, revenueChecks, type RevenueChecks } from "@/lib/dashboard/revenueCompanies";
import { saveRevenueDataToFirebase } from "@/lib/firebase";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  CloudUpload,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface RevenueImportModalProps {
  open: boolean;
  onClose: () => void;
  currentData: RevenueData | null;
  onDataUpdated: (newData: RevenueData) => void;
  isAdmin?: boolean;
}

const moneyUsd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v || 0);

export function RevenueImportModal({
  open,
  onClose,
  currentData,
  onDataUpdated,
  isAdmin = true,
}: RevenueImportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    monthsCount: number;
    totalRevenue: number;
    newData: RevenueData;
    /** Each sheet read: label, months, range, EST.Revenue total. */
    sheets: { label: string; name: string; months: number; range: string; total: number }[];
    checks: RevenueChecks;
    rates: { months: number; range: string; unmatched: number };
  } | null>(null);

  const [importMode, setImportMode] = useState<"overwrite" | "merge">("overwrite");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setIsProcessing(true);
    setFeedback(null);
    setParsedPreview(null);

    try {
      // Overall + one sheet per company, matched by sheet name; numbers as the file gives them.
      const wb = await parseRevenueWorkbook(file);
      const parsedItems = wb.overall || [];
      if (!wb.overall && !currentData?.monthly.length) {
        throw new Error("ไม่พบ sheet Overall ในไฟล์ และยังไม่มีข้อมูลรวมในระบบ");
      }
      if (parsedItems.length === 0 && !wb.digital?.length && !wb.entertainment?.length) {
        throw new Error("ไม่พบข้อมูลรายได้รายเดือนในไฟล์");
      }

      // Overwrite replaces what the file holds; merge replaces only its months. Sheets not in the file stay as they are.
      const combine = (current: MonthlyRevenueItem[] | undefined, incoming: MonthlyRevenueItem[] | null) => {
        if (!incoming) return current;
        if (importMode === "overwrite") return [...incoming].sort((a, b) => a.month.localeCompare(b.month));
        const monthMap = new Map<string, MonthlyRevenueItem>();
        (current || []).forEach((m) => monthMap.set(m.month, m));
        incoming.forEach((m) => monthMap.set(m.month, m));
        return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
      };
      const finalMonthly = combine(currentData?.monthly, wb.overall) || [];

      const totalRevenue = finalMonthly.reduce((acc, curr) => acc + curr.estRevenue, 0);

      const newData: RevenueData = {
        generatedAt: new Date().toISOString(),
        monthly: finalMonthly,
        digital: combine(currentData?.digital, wb.digital),
        entertainment: combine(currentData?.entertainment, wb.entertainment),
        // Rates: the file's replace (overwrite) or update (merge) what is stored; none in the file keeps the stored ones.
        rates: wb.rates ? (importMode === "overwrite" ? wb.rates : { ...(currentData?.rates || {}), ...wb.rates }) : currentData?.rates,
      };
      const rateMonths = Object.keys(wb.rates || {}).sort();

      const label = { overall: "Overall (รวม)", ...COMPANY_LABEL };
      setParsedPreview({
        monthsCount: parsedItems.length,
        totalRevenue,
        newData,
        sheets: wb.sheets.map((sh) => {
          const items = wb[sh.role] || [];
          return {
            label: label[sh.role],
            name: sh.name,
            months: items.length,
            range: items.length ? `${items[0].monthLabel} – ${items[items.length - 1].monthLabel}` : "-",
            total: items.reduce((a, m) => a + m.estRevenue, 0),
          };
        }),
        checks: revenueChecks(wb.overall, wb.digital, wb.entertainment),
        rates: {
          months: rateMonths.length,
          range: rateMonths.length ? `${rateMonths[0]} – ${rateMonths[rateMonths.length - 1]}` : "",
          unmatched: wb.unmatchedRates,
        },
      });

      setFeedback({
        type: "success",
        text: `อ่านไฟล์ "${file.name}" สำเร็จ · ตรวจเดือนและตัวเลขแต่ละ sheet ด้านล่างให้ถูกก่อนบันทึก`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "ไม่สามารถอ่านไฟล์ได้ โปรดตรวจสอบรูปแบบไฟล์",
      });
    } finally {
      setIsProcessing(false);
    }
  };


  const handleSaveToCloud = async () => {
    if (!parsedPreview) return;
    setCloudSaving(true);
    setFeedback(null);
    setProgress(null);

    try {
      await saveRevenueDataToFirebase(parsedPreview.newData, (curr, total) => {
        setProgress({ current: curr, total });
      });

      onDataUpdated(parsedPreview.newData);
      setFeedback({
        type: "success",
        text: `บันทึกข้อมูล YouTube Revenue ขึ้น Firebase สำเร็จเรียบร้อย!`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกขึ้น Firebase",
      });
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="source-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <button className="close" onClick={onClose}>
          <X />
        </button>

        <div className="modal-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
          <BadgeDollarSign />
        </div>

        <h2>นำเข้าข้อมูล Revenue Report (YouTube)</h2>
        <p>
          อัปโหลดไฟล์รายงานรายได้รายเดือนของ YouTube (.xlsx / .csv / Tab Delimited)
          เพื่ออัปเดตและบันทึกข้อมูลขึ้นระบบ Cloud (Firebase)
        </p>

        {/* Import Mode Selection */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setImportMode("overwrite")}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: importMode === "overwrite" ? "#fff" : "transparent",
              color: importMode === "overwrite" ? "#2563eb" : "#64748b",
              boxShadow: importMode === "overwrite" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            🔄 ลบข้อมูลเก่าและแทนที่ทั้งหมด (Overwrite)
          </button>
          <button
            type="button"
            onClick={() => setImportMode("merge")}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: importMode === "merge" ? "#fff" : "transparent",
              color: importMode === "merge" ? "#2563eb" : "#64748b",
              boxShadow: importMode === "merge" ? "0 2px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            ➕ อัปเดตผสานข้อมูลเดิม (Merge)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          hidden
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />


        <div
          onClick={() => !isProcessing && !cloudSaving && fileInputRef.current?.click()}
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: 12,
            padding: "24px 16px",
            textAlign: "center",
            cursor: isProcessing || cloudSaving ? "not-allowed" : "pointer",
            background: "#f8fafc",
            transition: "all 0.2s",
            display: "grid",
            placeContent: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          {isProcessing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 className="animate-spin" size={20} color="#2563eb" />
              <span>กำลังประมวลผลไฟล์...</span>
            </div>
          ) : (
            <>
              <div style={{ margin: "0 auto", color: "#2563eb" }}>
                <Upload size={28} />
              </div>
              <strong style={{ fontSize: 14 }}>คลิกเพื่อเลือกไฟล์ Excel / CSV / TSV</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                คอลัมน์ที่รองรับ: Monthly, EST.Revenue, Estimated partner ad revenue, YouTube Premium, Affiliate program, Shorts Feed ads ฯลฯ
              </span>
            </>
          )}
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
              color: feedback.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {parsedPreview && (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#1e40af", fontSize: 14 }}>
                สรุปข้อมูลที่ตรวจพบ ({parsedPreview.monthsCount} เดือน)
              </strong>
              <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 700 }}>
                {moneyUsd(parsedPreview.totalRevenue)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#334155" }}>
              รวมยอดสะสมทั้งหมดในระบบหลังอัปเดต: {parsedPreview.newData.monthly.length} เดือน
            </div>

            <table className="revenue-import-sheets">
              <thead>
                <tr>
                  <th>Sheet</th>
                  <th>เดือน</th>
                  <th className="num">EST.Revenue รวม</th>
                </tr>
              </thead>
              <tbody>
                {parsedPreview.sheets.map((sh) => (
                  <tr key={sh.name}>
                    <td>
                      <b>{sh.label}</b>
                      <small>{sh.name}</small>
                    </td>
                    <td>
                      {sh.months} เดือน
                      <small>{sh.range}</small>
                    </td>
                    <td className="num">{moneyUsd(sh.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 12, color: "#334155" }}>
              {parsedPreview.rates.months
                ? `อัตราแลกเปลี่ยน (คอลัมน์ Rate) ${parsedPreview.rates.months} เดือน: ${parsedPreview.rates.range}`
                : "ไม่พบคอลัมน์ Rate ในไฟล์ · อัตราที่มีในระบบจะใช้ต่อ"}
              {parsedPreview.rates.unmatched > 0 && ` · จับคู่เดือนไม่ได้ ${parsedPreview.rates.unmatched} แถว (ไม่ได้ใช้)`}
            </div>

            {(parsedPreview.checks.gaps.length > 0 || parsedPreview.checks.columns.length > 0 || parsedPreview.checks.totals.length > 0) && (
              <div className="revenue-import-checks">
                <strong>
                  <AlertCircle size={14} /> ตัวเลขที่ไม่ลงกันในไฟล์ (ระบบบันทึกตามไฟล์ ไม่ได้แก้ให้)
                </strong>
                {parsedPreview.checks.gaps.length > 0 && (
                  <p>
                    Overall มากกว่า Digital + Entertainment ใน {parsedPreview.checks.gaps.length} เดือน (เช่น{" "}
                    {parsedPreview.checks.gaps.slice(0, 2).map((g) => `${g.month}: ${moneyUsd(g.gap)}`).join(", ")}) · หน้ารายงานแสดงส่วนนี้เป็น “ส่วนที่ไม่อยู่ใน 2 sheet”
                  </p>
                )}
                {parsedPreview.checks.columns.length > 0 && (
                  <p>
                    คอลัมน์ที่ 2 บริษัทรวมกันมากกว่า Overall (อาจกรอกคนละคอลัมน์):{" "}
                    {parsedPreview.checks.columns.slice(0, 3).map((c) => `${c.month} ${c.label} ${moneyUsd(c.companies)} > ${moneyUsd(c.overall)}`).join(" · ")}
                  </p>
                )}
                {parsedPreview.checks.totals.length > 0 && (
                  <p>
                    EST.Revenue ไม่เท่ากับผลรวมคอลัมน์ย่อย {parsedPreview.checks.totals.length} จุด:{" "}
                    {parsedPreview.checks.totals.slice(0, 3).map((t) => `${t.sheet} ${t.month} ต่าง ${moneyUsd(t.diff)}`).join(" · ")}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleSaveToCloud}
              disabled={cloudSaving || !isAdmin}
              style={{
                marginTop: 6,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#fff",
                fontWeight: 600,
                height: 42,
                gap: 8,
              }}
            >
              {cloudSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  กำลังบันทึกข้อมูลขึ้น Firebase...{" "}
                  {progress ? `(${progress.current}/${progress.total})` : ""}
                </>
              ) : (
                <>
                  <CloudUpload size={18} />
                  บันทึกข้อมูลขึ้น Cloud (Firebase)
                </>
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
