"use client";
// Starts collapsible cards for the page (lib/cardCollapse.ts) and shows
// "ยุบทั้งหมด / ขยายทั้งหมด" for the sections of the open tab.
import { useEffect } from "react";
import { setAllCards, startCardCollapse } from "@/lib/cardCollapse";

export function CollapseControls() {
  useEffect(() => startCardCollapse(), []);
  return (
    <div className="collapse-controls" aria-label="ยุบ / ขยายการ์ด">
      <button type="button" onClick={() => setAllCards(true)} title="ยุบทุกส่วนในหน้านี้ (กดหัวข้อเพื่อเปิดทีละส่วน)">
        ยุบทั้งหมด
      </button>
      <button type="button" onClick={() => setAllCards(false)} title="แสดงทุกการ์ดในหน้านี้">
        ขยายทั้งหมด
      </button>
    </div>
  );
}
