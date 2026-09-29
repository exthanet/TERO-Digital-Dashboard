import { ChevronDown } from "lucide-react";

export function SelectBox({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
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
