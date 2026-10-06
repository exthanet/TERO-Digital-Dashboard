"use client";
import { SelectBox } from "@/components/dashboard/shared/SelectBox";
import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/hooks/useDashboard";
import { datePresetGroups } from "@/lib/dashboard/dates";
import type { DatePreset } from "@/lib/dashboard/types";
import { Search } from "lucide-react";
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
}: {
  /** Enter in the search box / the button beside it: open รายงาน → ผลการค้นหา. */
  onSearch?: () => void;
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
  return (
    <>
      {/* Phones keep only รายการ and วันเดือนปี; app/dashboard.tsx resets the rest */}
      <div className="topbar">
        <SelectBox
          label="รายการทั้งหมด"
          value={program}
          onChange={setProgram}
          options={options.programs}
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
            }}
            placeholder="ค้นหา: ประเด็น / #hashtag (หลายคำคั่นด้วย ,)"
            title="ค้นจากชื่อคลิป รายการ ช่อง และ hashtag · หลายคำคั่นด้วยจุลภาค = เจอคำใดคำหนึ่ง · กด Enter เพื่อดูสรุปผลการค้นหา"
          />
          {onSearch && search.trim() && (
            <button type="button" className="search-go" onClick={onSearch}>
              ดูสรุป
            </button>
          )}
        </label>
      </div>
    </>
  );
}
