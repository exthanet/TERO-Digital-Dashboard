import type { CompareSortKey } from "@/lib/dashboard/types";

export function SortHead({
  label,
  column,
  active,
  direction,
  onSort,
  className,
}: {
  label: string;
  column: CompareSortKey;
  active: CompareSortKey;
  direction: "asc" | "desc";
  onSort: (key: CompareSortKey) => void;
  className?: string;
}) {
  return (
    <th className={className}>
      <button className="sort-head" onClick={() => onSort(column)}>
        {label}
        <span>
          {active === column ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
