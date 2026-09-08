import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import { TOPIC_COLORS } from "@/lib/dashboard/constants";
import { num } from "@/lib/dashboard/format";
import { Empty } from "@/components/dashboard/shared/Empty";

export function ViewPie({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Array<{ name: string; total: number }>;
}) {
  const total = data.reduce((a, x) => a + x.total, 0);
  return (
    <article className="panel executive-pie">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {data.length ? (
        <div className="mini-pie-wrap">
          <ResponsiveContainer width="52%" height={205}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                innerRadius={45}
                outerRadius={76}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => num(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend-list">
            {data.map((x, i) => (
              <div key={x.name}>
                <i
                  style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }}
                />
                <span>{x.name}</span>
                <b>
                  {total ? `${((x.total / total) * 100).toFixed(1)}%` : "0%"}
                </b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Empty />
      )}
    </article>
  );
}
