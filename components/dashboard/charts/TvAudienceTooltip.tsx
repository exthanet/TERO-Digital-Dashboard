import { num, dateLabel } from "@/lib/dashboard/format";

export function TvAudienceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { topics?: string[] };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const topics = payload[0]?.payload?.topics || [];
  return (
    <div className="performance-tooltip">
      <strong>{dateLabel(String(label))}</strong>
      {payload.map((x, i) => (
        <div className="tooltip-value" key={`${x.name}-${i}`}>
          <i style={{ background: x.color || "#1261dc" }} />
          <span>{x.name}</span>
          <b>{num(Number(x.value || 0))}</b>
        </div>
      ))}
      {topics.length > 0 && (
        <div className="tooltip-topics">
          <span>Topic</span>
          <ul>
            {topics.slice(0, 5).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {topics.length > 5 && (
            <small>และอีก {topics.length - 5} ประเด็น</small>
          )}
        </div>
      )}
    </div>
  );
}
