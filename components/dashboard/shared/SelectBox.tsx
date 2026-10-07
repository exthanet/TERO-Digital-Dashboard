import { ChevronDown } from "lucide-react";

export function SelectBox({
  label,
  value,
  onChange,
  options,
  className,
  locked,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  /** Shown instead of the choice and not selectable (the page ignores this filter). */
  locked?: string;
}) {
  if (locked) {
    return (
      <label className={`filter-box filter-locked${className ? ` ${className}` : ""}`} title="หน้านี้ไม่ใช้ตัวกรองนี้">
        <span>{label}</span>
        <div>
          <select value="locked" disabled aria-disabled="true">
            <option value="locked">{locked}</option>
          </select>
        </div>
      </label>
    );
  }
  return (
    <label className={className ? `filter-box ${className}` : "filter-box"}>
      <span>{label}</span>
      <div>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="ALL">ทั้งหมด</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={15} />
      </div>
    </label>
  );
}
