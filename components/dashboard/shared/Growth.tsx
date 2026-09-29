/** Green ▲ / red ▼ with the % change; renders nothing when there is no base to compare. */
export function Growth({
  value,
  label,
  title,
}: {
  value: number | null | undefined;
  label?: string;
  title?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.0005;
  const tone = flat ? "flat" : value > 0 ? "up" : "down";
  return (
    <span className={`kpi-growth ${tone}`} title={title}>
      {label && <span className="kpi-growth-label">{label}</span>}
      {flat ? "■" : value > 0 ? "▲" : "▼"} {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}
