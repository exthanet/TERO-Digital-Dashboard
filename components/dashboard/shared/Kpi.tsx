export function Kpi({
  tone,
  icon,
  label,
  value,
  detail,
  growth,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  /** % change badge(s) shown beside the value. */
  growth?: React.ReactNode;
}) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {growth && <div className="kpi-growth-row">{growth}</div>}
        <small>{detail}</small>
      </div>
    </article>
  );
}
