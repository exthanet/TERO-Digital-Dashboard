import { num, dateLabel } from "@/lib/dashboard/format";

export function TvAudienceTooltip({
  active,
  payload,
  label,
  formatLabel = dateLabel,
  perEpisode = false,
}: {
  /** The point's title (a day by default; "ก.ย. 69" for a month). */
  formatLabel?: (label: string) => string;
  /** Month / year points: each value is the average per episode. */
  perEpisode?: boolean;
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { topics?: string[]; oneEpisodes?: number; gmmEpisodes?: number };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const topics = perEpisode ? [] : point?.topics || [];
  return (
    <div className="performance-tooltip">
      <strong>{formatLabel(String(label))}</strong>
      {perEpisode && <small>ผู้ชมเฉลี่ยต่อเทป · One31 {num(point?.oneEpisodes || 0)} เทป · GMM25 {num(point?.gmmEpisodes || 0)} เทป</small>}
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
