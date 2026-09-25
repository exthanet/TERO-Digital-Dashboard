"use client";

import React from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

type ZoneRating = { zone: string; rating: number; source: string };

const ZONE_CONFIG: Record<
  string,
  { label: string; color: string; bgGradient: string; badgeColor: string }
> = {
  "15+BKK": {
    label: "15+BKK (กรุงเทพฯ)",
    color: "#16a34a",
    bgGradient: "linear-gradient(135deg, #16a34a, #15803d)",
    badgeColor: "#dcfce7",
  },
  "15+BKK&URBAN": {
    label: "15+BKK & URBAN (กรุงเทพฯ และหัวเมือง)",
    color: "#9333ea",
    bgGradient: "linear-gradient(135deg, #9333ea, #7e22ce)",
    badgeColor: "#f3e8ff",
  },
  "15+RURAL": {
    label: "15+RURAL (ชนบท / นอกเขตเทศบาล)",
    color: "#0891b2",
    bgGradient: "linear-gradient(135deg, #0891b2, #0e7490)",
    badgeColor: "#cffafe",
  },
  "15+URBAN": {
    label: "15+URBAN (เขตเทศบาล / หัวเมือง)",
    color: "#f59e0b",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    badgeColor: "#fef3c7",
  },
};

const number = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(v || 0);

interface TreemapContentProps {
  root?: unknown;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  rating?: number;
  share?: number;
  fill?: string;
}

const CustomTreemapNode = (props: TreemapContentProps) => {
  const { x = 0, y = 0, width = 0, height = 0, name = "", rating = 0, share = 0 } = props;
  const cfg = ZONE_CONFIG[name] || {
    label: name,
    color: "#3b82f6",
    bgGradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  };

  if (width < 30 || height < 30) return null;

  const isCompact = width < 140 || height < 80;

  return (
    <g>
      <rect
        x={x + 3}
        y={y + 3}
        width={Math.max(0, width - 6)}
        height={Math.max(0, height - 6)}
        rx={8}
        ry={8}
        fill={cfg.color}
        fillOpacity={0.9}
        stroke="#ffffff"
        strokeWidth={2}
        style={{
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
          transition: "all 0.3s ease",
          cursor: "pointer",
        }}
      />
      <text
        x={x + 12}
        y={y + (isCompact ? 22 : 28)}
        fill="#ffffff"
        fontSize={isCompact ? 12 : 14}
        fontWeight={800}
        fontFamily="sans-serif"
      >
        {name}
      </text>
      {!isCompact && (
        <text
          x={x + 12}
          y={y + 46}
          fill="#ffffff"
          opacity={0.88}
          fontSize={11}
          fontFamily="sans-serif"
        >
          {cfg.label}
        </text>
      )}
      <text
        x={x + 12}
        y={y + height - 14}
        fill="#ffffff"
        fontSize={isCompact ? 14 : 18}
        fontWeight={900}
        fontFamily="sans-serif"
      >
        ★ {number(rating)}
        <tspan
          dx={8}
          fontSize={isCompact ? 11 : 12}
          fontWeight={600}
          fill="#ffffff"
          opacity={0.9}
        >
          ({(share * 100).toFixed(1)}%)
        </tspan>
      </text>
    </g>
  );
};

export default function TvRatingChoropleth({ data }: { data: ZoneRating[] }) {
  const targetZones = ["15+BKK", "15+BKK&URBAN", "15+RURAL", "15+URBAN"];

  const parsedData = targetZones.map((zoneKey) => {
    const item = data.find((d) => d.zone === zoneKey || d.source === zoneKey);
    const rating = item?.rating || 0;
    return {
      name: zoneKey,
      rating,
      value: Math.max(0.0001, rating),
      fill: ZONE_CONFIG[zoneKey]?.color || "#2563EB",
    };
  });

  const totalRatingSum = parsedData.reduce((acc, curr) => acc + curr.rating, 0);

  const treeData = [
    {
      name: "Rating Zones",
      children: parsedData.map((d) => ({
        ...d,
        share: totalRatingSum > 0 ? d.rating / totalRatingSum : 0.25,
      })),
    },
  ];

  const hasData = parsedData.some((d) => d.rating > 0);

  return (
    <article className="panel tv-map-panel" id="rating-zone">
      <div className="panel-head">
        <div>
          <h2>TV Rating Zone</h2>
          <p>
            Treemap สัดส่วนคะแนน Rating เฉลี่ย
          </p>
        </div>
        <span className="province-count">4 โซน</span>
      </div>

      {hasData ? (
        <>
          <div style={{ width: "100%", height: 260, marginTop: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeData}
                dataKey="value"
                aspectRatio={1.2}
                stroke="#fff"
                content={<CustomTreemapNode />}
              >
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const cfg = ZONE_CONFIG[d.name];
                      return (
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            padding: "8px 12px",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)",
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              color: cfg?.color || "#0f172a",
                              marginBottom: 4,
                            }}
                          >
                            {cfg?.label || d.name}
                          </div>
                          <div style={{ color: "#334155", display: "flex", gap: 10 }}>
                            <span>Rating เฉลี่ย:</span>
                            <strong>{number(d.rating)}</strong>
                          </div>
                          <div style={{ color: "#64748b", marginTop: 2 }}>
                            สัดส่วน: <strong>{((d.share || 0) * 100).toFixed(2)}%</strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            {parsedData.map((x) => {
              const cfg = ZONE_CONFIG[x.name];
              const share = totalRatingSum > 0 ? (x.rating / totalRatingSum) * 100 : 0;
              return (
                <div
                  key={x.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: cfg?.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {x.name}
                    </div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>
                      {share.toFixed(1)}%
                    </div>
                  </div>
                  <strong style={{ fontSize: 11, color: "#0f172a" }}>
                    {number(x.rating)}
                  </strong>
                </div>
              );
            })}
          </div>

          <p className="map-note" style={{ marginTop: 8 }}>
            หมายเหตุ: พื้นที่สี่เหลี่ยม (Treemap) คำนวณตามสัดส่วน Rating เฉลี่ย 4 กลุ่มโซน
          </p>
        </>
      ) : (
        <div className="map-empty">
          <div className="thailand-outline">TV</div>
          <div>
            <strong>ยังไม่มีข้อมูล TV Rating สำหรับโซน</strong>
            <p>
              เลือก Cross Platform = TV หรือตรวจสอบข้อมูลคะแนน Rating (15+BKK, 15+URBAN, 15+BKK&amp;URBAN, 15+RURAL) ในชุดข้อมูล
            </p>
            <small>ระบบจะแสดง Treemap Graph ตามสัดส่วน Rating ให้อัตโนมัติ</small>
          </div>
        </div>
      )}
    </article>
  );
}
