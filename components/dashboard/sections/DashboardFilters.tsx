"use client";
import { SelectBox } from "@/components/dashboard/shared/SelectBox";
import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/hooks/useDashboard";
import { datePresetGroups } from "@/lib/dashboard/dates";
import type { DatePreset } from "@/lib/dashboard/types";
import { Search, X } from "lucide-react";
import { searchTerms } from "@/lib/dashboard/search";

/** The program the dashboard opens with; "ล้างทั้งหมด" goes back to it. */
const DEFAULT_PROGRAM = "ถกไม่เถียง";
const thDay = (iso: string, withYear: boolean) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(
    new Date(`${iso}T00:00:00Z`),
  );
/** "3 ก.ย. – 30 ก.ย. 2569" for the selected range. */
const rangeLabel = (start: string, end: string) =>
  start && end ? `${thDay(start, start.slice(0, 4) !== end.slice(0, 4))} – ${thDay(end, true)}` : "";

export function DashboardFilters({
  program,
  setProgram,
  platform,
  setPlatform,
  vdoType,
  setVdoType,
  topicType,
  setTopicType,
  search,
  setSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  datePreset,
  setDatePreset,
  options,
  applyDatePreset,
  dataFirstDate,
  onSearch,
  busy = false,
  programLocked = false,
}: {
  /** The page shows every program (รวมรายการ): the program filter is locked. */
  programLocked?: boolean;
  /** Enter in the search box / the button beside it: open รายงาน → ผลการค้นหา. */
  onSearch?: () => void;
  /** The report is being worked out for new filters (shown in words, not only the thin top bar). */
  busy?: boolean;
} & Pick<
  DashboardModel,
  | "program"
  | "setProgram"
  | "platform"
  | "setPlatform"
  | "vdoType"
  | "setVdoType"
  | "topicType"
  | "setTopicType"
  | "search"
  | "setSearch"
  | "startDate"
  | "setStartDate"
  | "endDate"
  | "setEndDate"
  | "datePreset"
  | "setDatePreset"
  | "options"
  | "applyDatePreset"
  | "dataFirstDate"
>) {
  const groups = datePresetGroups(dataFirstDate);
  const custom = datePreset === "CUSTOM";
  // Every filter that is not the default, each with its own ×; search terms one by one.
  const terms = searchTerms(search);
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...terms.map((t) => ({
      key: `q-${t}`,
      label: `ค้นหา: ${t}`,
      clear: () => setSearch(terms.filter((x) => x !== t).join(", ")),
    })),
    ...(!programLocked && program !== DEFAULT_PROGRAM ? [{ key: "program", label: `รายการ: ${program === "ALL" ? "ทั้งหมด" : program}`, clear: () => setProgram(DEFAULT_PROGRAM) }] : []),
    ...(platform !== "ALL" ? [{ key: "platform", label: `แพลตฟอร์ม: ${platform}`, clear: () => setPlatform("ALL") }] : []),
    ...(vdoType !== "ALL" ? [{ key: "vdo", label: `VDO Type: ${vdoType}`, clear: () => setVdoType("ALL") }] : []),
    ...(topicType !== "ALL" ? [{ key: "topic", label: `Topic Type: ${topicType}`, clear: () => setTopicType("ALL") }] : []),
  ];
  const clearAll = () => {
    setSearch("");
    setProgram(DEFAULT_PROGRAM);
    setPlatform("ALL");
    setVdoType("ALL");
    setTopicType("ALL");
  };
  return (
    <>
      {/* Phones keep only รายการ and วันเดือนปี; app/dashboard.tsx resets the rest */}
      <div className="topbar">
        <SelectBox
          label="รายการทั้งหมด"
          value={program}
          onChange={setProgram}
          options={options.programs}
          locked={programLocked ? "ทุกรายการ (หน้านี้แสดงทุกรายการ)" : undefined}
        />
        <label className="filter-box date-filter">
          <span>วันเดือนปี</span>
          <div>
            <select
              className="quick-range"
              value={datePreset}
              onChange={(e) => applyDatePreset(e.target.value as DatePreset)}
            >
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {custom ? (
              <>
            <input
              className="date-input"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("CUSTOM");
              }}
            />
            <b>–</b>
            <input
              className="date-input"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("CUSTOM");
              }}
            />
              </>
            ) : (
              <span className="date-range-text">{rangeLabel(startDate, endDate)}</span>
            )}
          </div>
        </label>
        <SelectBox
          className="mobile-hide"
          label="Cross Platform"
          value={platform}
          onChange={setPlatform}
          options={options.platforms}
        />
        <SelectBox
          className="mobile-hide"
          label="VDO Type"
          value={vdoType}
          onChange={setVdoType}
          options={options.vdoTypes}
        />
        <SelectBox
          className="mobile-hide"
          label="Topic Type"
          value={topicType}
          onChange={setTopicType}
          options={options.topicTypes}
        />
        <label className="search-box mobile-hide">
          <Search />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSearch) onSearch();
              if (e.key === "Escape") setSearch("");
            }}
            placeholder="ค้นหา: ประเด็น / #hashtag (หลายคำคั่นด้วย ,)"
            title="ค้นจากชื่อคลิป รายการ ช่อง และ hashtag · หลายคำคั่นด้วยจุลภาค = เจอคำใดคำหนึ่ง · กด Enter เพื่อดูสรุปผลการค้นหา"
          />
          {search && (
            <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="ล้างคำค้น" title="ล้างคำค้น (Esc)">
              <X size={14} />
            </button>
          )}
          {onSearch && search.trim() && (
            <button type="button" className="search-go" onClick={onSearch}>
              ดูสรุป
            </button>
          )}
        </label>
      </div>
      {(chips.length > 0 || busy) && (
        <div className="active-filters" aria-label="ตัวกรองที่ใช้อยู่">
          {busy && (
            <span className="filter-busy" role="status">
              กำลังคำนวณตัวเลขใหม่…
            </span>
          )}
          {chips.length > 0 && <span>กำลังกรอง:</span>}
          {chips.map((c) => (
            <button key={c.key} type="button" className="filter-chip" onClick={c.clear} title="ยกเลิกตัวกรองนี้">
              {c.label} <X size={12} />
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className="filter-clear-all" onClick={clearAll}>
              ล้างทั้งหมด
            </button>
          )}
        </div>
      )}
    </>
  );
}
