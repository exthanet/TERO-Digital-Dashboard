"use client";
// รายงานประจำเดือน → edit mode: the pages as a short list to drag into a new order
// (the browser's own drag and drop, mouse only; ▲ ▼ on each page still work on touch).
import { useState } from "react";
import { Eye, EyeOff, GripVertical } from "lucide-react";

interface Page {
  id: string;
  title?: string;
  cover?: boolean;
  hidden: boolean;
}

interface Props {
  pages: Page[];
  /** Drop page `id` before the page now at `to` (pages.length = last). */
  onMove: (id: string, to: number) => void;
  onToggle: (id: string) => void;
  /** Scroll to the page's editor. */
  onGo: (index: number) => void;
}

export function ReportPageList({ pages, onMove, onToggle, onGo }: Props) {
  const [dragging, setDragging] = useState("");
  // Where the dragged page would land: before the row at this index.
  const [over, setOver] = useState<number | null>(null);

  const drop = () => {
    if (dragging && over !== null) onMove(dragging, over);
    setDragging("");
    setOver(null);
  };

  return (
    <div className="mr-page-list">
      <p className="mr-page-list-head">
        <b>ลำดับหน้า</b> · กดค้างที่แถวแล้วลากขึ้นลงเพื่อย้ายหน้า · กดชื่อเพื่อไปที่หน้านั้น
      </p>
      <ol
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          drop();
        }}
      >
        {pages.map((p, i) => (
          <li
            key={p.id}
            draggable
            className={`${p.hidden ? "off" : ""}${dragging === p.id ? " dragging" : ""}${over === i ? " drop-before" : ""}${over === pages.length && i === pages.length - 1 ? " drop-after" : ""}`}
            onDragStart={(e) => {
              setDragging(p.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", p.id);
            }}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setOver(e.clientY < r.top + r.height / 2 ? i : i + 1);
            }}
            onDragEnd={() => {
              setDragging("");
              setOver(null);
            }}
          >
            <GripVertical size={15} className="mr-grip" aria-hidden />
            <span className="mr-page-no">{i + 1}</span>
            <button type="button" className="mr-page-go" onClick={() => onGo(i)} title="ไปที่หน้านี้">
              {p.cover ? "หน้าปก" : p.title || p.id}
            </button>
            <button type="button" className="mr-page-eye" onClick={() => onToggle(p.id)} title={p.hidden ? "แสดงหน้านี้" : "ซ่อนหน้านี้"} aria-label={p.hidden ? "แสดงหน้านี้" : "ซ่อนหน้านี้"}>
              {p.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
