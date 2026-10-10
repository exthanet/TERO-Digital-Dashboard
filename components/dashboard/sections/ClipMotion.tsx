"use client";
// วิเคราะห์คลิป: the parts in the motion dashboard look (output/motion-demo.html):
// count-up tiles, the platform share bar, posting-hour chart, fact cards and the
// clip's YouTube Analytics box. Numbers come from lib/dashboard/clipDetail.ts and
// ytAnalytics; nothing here changes them. Motion follows "reduce motion".
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MonitorPlay } from "lucide-react";
import { compact, num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import { postId } from "@/lib/dashboard/postKey";
import type { ClipPost } from "@/lib/dashboard/clipDetail";
import { TRAFFIC_LABEL, type YtDeepDiveData } from "@/lib/dashboard/ytDeepDive";
import { loadYtAnalytics } from "@/lib/ytAnalyticsData";
import { track } from "@/lib/loadingBar";
import { CountUp, useMotion } from "@/components/dashboard/shared/Motion";

const colorOf = (p: string) => PLATFORM_COLORS[p] || "#64748b";
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export interface ClipTile {
  label: string;
  value: number | null;
  format: (v: number) => string;
  detail: string;
}

/** The headline numbers as tiles that count up. */
export function ClipTiles({ tiles }: { tiles: ClipTile[] }) {
  return (
    <div className="ps-tiles cm-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="ps-tile static">
          <small>{t.label}</small>
          <b>{t.value === null ? "…" : <CountUp value={t.value} format={t.format} />}</b>
          <span className="cm-detail">{t.detail}</span>
        </div>
      ))}
    </div>
  );
}

/** One bar split by each post's share of the total views. */
export function ShareBar({ posts, total }: { posts: ClipPost[]; total: number }) {
  if (posts.length < 2 || total <= 0) return null;
  return (
    <div className="cm-share" aria-label="สัดส่วนวิวแต่ละแพลตฟอร์ม">
      <div className="cm-share-bar">
        {posts.map((p) => (
          <span key={p.key || p.row.url} style={{ width: `${(p.row.views / total) * 100}%`, background: colorOf(p.row.platform) }} title={`${p.row.platform} ${p.row.vdoType} · ${num(p.row.views)} วิว`} />
        ))}
      </div>
      <div className="cm-share-legend">
        {posts.map((p) => (
          <span key={p.key || p.row.url}>
            <i style={{ background: colorOf(p.row.platform) }} />
            {p.row.platform} <b>{Math.round((p.row.views / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Median views per clip by posting hour for the post's group; this clip's hour and the best hour marked. */
export function HourChart({ post }: { post: ClipPost }) {
  const motion = useMotion();
  const color = colorOf(post.row.platform);
  if (!post.hours.some((h) => h.median !== null)) return null;
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={post.hours} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
        <YAxis hide />
        <Tooltip
          labelFormatter={(h) => `${hh(Number(h))} น.`}
          formatter={(v, _n, p) => {
            const x = p?.payload as ClipPost["hours"][number];
            return [v === null || v === undefined ? `${x?.clips || 0} คลิป น้อยเกินไป` : `${compact(Number(v))}/คลิป · ${x.clips} คลิป`, "ค่ากลาง"];
          }}
        />
        {post.hour !== null && <ReferenceLine x={post.hour} stroke="#0f172a" strokeDasharray="3 3" label={{ value: "คลิปนี้", fontSize: 10, position: "top" }} />}
        <Bar dataKey="median" radius={[3, 3, 0, 0]} isAnimationActive={motion}>
          {post.hours.map((h) => (
            <Cell key={h.hour} fill={h.hour === post.bestHour?.hour ? "#16a34a" : color} fillOpacity={h.hour === post.hour || h.hour === post.bestHour?.hour ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** "สรุปจากตัวเลข" as cards that come in one after another. */
export function FactCards({ facts }: { facts: string[] }) {
  return (
    <ul className="cm-facts">
      {facts.map((f, i) => (
        <li key={f} style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
          {f}
        </li>
      ))}
    </ul>
  );
}

/**
 * YouTube Analytics of this clip (Deep Dive permission): retention and traffic sources.
 * Without the permission Firestore refuses the read and the box is not shown.
 */
export function YtClipBox({ posts }: { posts: ClipPost[] }) {
  const motion = useMotion();
  const ids = useMemo(() => posts.filter((p) => p.row.platform === "YouTube").map((p) => ({ id: postId("YouTube", p.row.url) || postId("YouTube", p.row.contentId), p })), [posts]);
  const [data, setData] = useState<YtDeepDiveData | null | "hidden">(null);
  const want = ids.length > 0;
  useEffect(() => {
    if (!want) return;
    let alive = true;
    track(loadYtAnalytics())
      .then((d) => alive && setData(d || "hidden"))
      .catch(() => alive && setData("hidden"));
    return () => {
      alive = false;
    };
  }, [want]);
  if (!want || data === null || data === "hidden") return null;
  const byId = new Map(data.videos.map((v) => [v.id, v]));
  const hit = ids.map((x) => ({ ...x, v: byId.get(x.id) })).find((x) => x.v);
  if (!hit || !hit.v) return null;
  const v = hit.v;
  const curve = data.retention.find((c) => c.id === hit.id)?.points || [];
  const traffic = Object.entries(v.traffic || {}).sort((a, b) => b[1] - a[1]);
  const tTotal = traffic.reduce((a, [, n]) => a + n, 0);
  const isShort = /short/i.test(hit.p.row.vdoType);
  const tiles: ClipTile[] = [
    { label: "ยอดดู (YouTube Analytics)", value: v.views, format: compact, detail: "ตั้งแต่ลงคลิป" },
    { label: "ดูเฉลี่ย", value: v.avgViewPct / 100, format: (x) => `${(x * 100).toFixed(0)}%`, detail: `${Math.round(v.avgViewSec)} วินาทีต่อครั้ง` },
    { label: "ผู้ติดตามที่ได้", value: v.subs, format: num, detail: "จากคลิปนี้" },
    ...(isShort && v.views > 0 ? [{ label: "ดูต่อ (ไม่ปัดทิ้ง)", value: v.engagedViews / v.views, format: (x: number) => `${(x * 100).toFixed(0)}%`, detail: "engaged views ÷ ยอดดู" }] : []),
  ];

  return (
    <section className="clip-detail-box cm-yt">
      <h3>
        <MonitorPlay size={15} /> YouTube Analytics ของคลิปนี้
      </h3>
      <ClipTiles tiles={tiles} />
      <div className="cm-yt-grid">
        {curve.length > 0 && (
          <div>
            <h4>การดูต่อของผู้ชม</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={curve} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e5e5e5" vertical={false} />
                <XAxis dataKey="at" type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(x: number) => `${Math.round(x * 100)}%`} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(x: number) => `${Math.round(x * 100)}%`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip labelFormatter={(x) => `ช่วง ${Math.round(Number(x) * 100)}% ของคลิป`} formatter={(x) => [`${Math.round(Number(x) * 100)}%`, "ยังดูอยู่"]} />
                <Line type="monotone" dataKey="watch" stroke="#cc0000" strokeWidth={2} dot={false} isAnimationActive={motion} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {traffic.length > 0 && (
          <div>
            <h4>แหล่งที่มาของการเข้าชม</h4>
            <div className="ps-bars">
              {traffic.slice(0, 6).map(([s, n]) => (
                <div key={s} className="ps-bar" title={`${num(n)} วิว`}>
                  <span className="ps-bar-label">{TRAFFIC_LABEL[s] || s}</span>
                  <span className="ps-bar-track">
                    <span style={{ width: `${tTotal ? (n / traffic[0][1]) * 100 : 0}%`, background: "#cc0000" }} />
                  </span>
                  <b>{tTotal ? `${((n / tTotal) * 100).toFixed(1)}%` : "-"}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="audience-note">
        จาก YouTube Analytics ตั้งแต่ลงคลิป (อัปเดตทุก sync) · ยอดดูอาจต่างจากตารางด้านบนเล็กน้อยเพราะดึงคนละเวลา
        {!curve.length && " · YouTube ส่งกราฟการดูต่อมาเฉพาะคลิปที่คนดูมากที่สุด"}
        {!traffic.length && " · แหล่งที่มามีเฉพาะคลิปยอดนิยม"}
      </p>
    </section>
  );
}
