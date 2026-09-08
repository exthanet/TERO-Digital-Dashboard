"use client";
import { SelectBox } from "@/components/dashboard/shared/SelectBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardModel } from "@/hooks/useDashboard";
import type { DatePreset } from "@/lib/dashboard/types";
import { Search, Upload } from "lucide-react";
export function DashboardFilters({
  setSourceOpen,
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
}: Pick<
  DashboardModel,
  | "setSourceOpen"
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
>) {
  return (
    <>
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
              <option value="ALL">ทั้งหมด</option>
              <option value="TODAY">วันนี้</option>
              <option value="LAST_7_DAYS">7 วันล่าสุด</option>
              <option value="THIS_MONTH">เดือนนี้</option>
              <option value="LAST_MONTH">เดือนที่แล้ว</option>
              <option value="THIS_YEAR">ปีนี้</option>
              <option value="LAST_YEAR">ปีที่แล้ว</option>
              <option value="QUARTER_1">ไตรมาส 1 (ม.ค.–มี.ค.)</option>
              <option value="QUARTER_2">ไตรมาส 2 (เม.ย.–มิ.ย.)</option>
              <option value="QUARTER_3">ไตรมาส 3 (ก.ค.–ก.ย.)</option>
              <option value="QUARTER_4">ไตรมาส 4 (ต.ค.–ธ.ค.)</option>
              <option value="CUSTOM">กำหนดเอง</option>
            </select>
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
          </div>
        </label>
        <SelectBox
          label="Cross Platform"
          value={platform}
          onChange={setPlatform}
          options={options.platforms}
        />
        <SelectBox
          label="VDO Type"
          value={vdoType}
          onChange={setVdoType}
          options={options.vdoTypes}
        />
        <SelectBox
          label="Topic Type"
          value={topicType}
          onChange={setTopicType}
          options={options.topicTypes}
        />
        <label className="search-box">
          <Search />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: ชื่อประเด็น"
          />
        </label>
        <Button variant="outline" onClick={() => setSourceOpen(true)}>
          <Upload />
          นำเข้าข้อมูล
        </Button>
      </div>
    </>
  );
}
