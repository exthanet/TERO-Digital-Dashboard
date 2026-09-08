"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/hooks/useDashboard";
import { FileSpreadsheet, Upload, X } from "lucide-react";
export function DataSourceModal({
  loading,
  sourceOpen,
  setSourceOpen,
  sheetUrl,
  setSheetUrl,
  fileRef,
  loadSheet,
  onFile,
}: Pick<
  DashboardModel,
  | "loading"
  | "sourceOpen"
  | "setSourceOpen"
  | "sheetUrl"
  | "setSheetUrl"
  | "fileRef"
  | "loadSheet"
  | "onFile"
>) {
  return (
    <>
      {sourceOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSourceOpen(false)}
        >
          <section
            className="source-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setSourceOpen(false)}>
              <X />
            </button>
            <div className="modal-icon">
              <FileSpreadsheet />
            </div>
            <h2>เชื่อมต่อข้อมูล Dashboard</h2>
            <p>
              วาง Google Sheets URL ที่เปิดสิทธิ์ให้ผู้มีลิงก์ดูได้ หรืออัปโหลด
              Master Data เป็น Excel/CSV
            </p>
            <label>
              <span>Google Sheets URL</span>
              <Input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </label>
            <Button onClick={loadSheet} disabled={!sheetUrl || loading}>
              {loading ? "กำลังโหลด..." : "เชื่อมต่อ Google Sheet"}
            </Button>
            <div className="divider">
              <span>หรือ</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload />
              อัปโหลด Excel / CSV
            </Button>
            <small>
              รองรับหัวคอลัมน์ตาม Master Data: Date, Program, Topic, Topic_Type,
              VDO_Type, Platform, Views, Engagement และ TV Rating
            </small>
          </section>
        </div>
      )}
    </>
  );
}
