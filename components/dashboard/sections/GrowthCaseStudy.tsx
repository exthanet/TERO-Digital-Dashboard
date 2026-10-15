"use client";
// การเติบโต → the first section: a case study worked out live from growthDaily
// (lib/dashboard/growthForecast.ts) — how much a new clip still gets after day 1,
// for how long, and how often that forecast was right on past clips.
import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num } from "@/lib/dashboard/format";
import { PLATFORM_COLORS } from "@/lib/dashboard/constants";
import type { CaseStudy, GroupStudy } from "@/lib/dashboard/growthForecast";
import { useMotion } from "@/components/dashboard/shared/Motion";

const COLORS: Record<string, string> = { ...PLATFORM_COLORS, TikTok: "#0f172a" };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const thDate = (iso: string) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`)) : "");

/** "Facebook Reels", "Instagram Post", "YouTube Shorts", "TikTok". */
export function groupLabel(g: Pick<GroupStudy, "platform" | "vdoType">): string {
  const t = g.vdoType || "";
  if (/reels/i.test(t)) return `${g.platform} Reels`;
  if (!t || t === g.platform) return g.platform;
  return t.toLowerCase().startsWith(g.platform.toLowerCase()) ? t : `${g.platform} ${t}`;
}
const isPost = (g: GroupStudy) => /post/i.test(g.vdoType);

export function GrowthCaseStudy({ study }: { study: CaseStudy }) {
  const motion = useMotion();
  const groups = study.groups;
  const withCurve = groups.filter((g) => g.curve.length);
  const curveData = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        day: i + 1,
        ...Object.fromEntries(withCurve.map((g) => [groupLabel(g), Math.round(g.curve[i] * 100)])),
      })),
    [withCurve],
  );
  const accData = [...groups].sort((a, b) => b.hitRate - a.hitRate).map((g) => ({ name: groupLabel(g), hit: Math.round(g.hitRate * 100), g }));
  // Plain-language findings from the numbers above.
  const byFade = withCurve.filter((g) => g.fadeDay !== null).sort((a, b) => a.fadeDay! - b.fadeDay!);
  const fastest = byFade.filter((g) => g.fadeDay === byFade[0]?.fadeDay).map(groupLabel);
  const slowest = byFade[byFade.length - 1];
  const best = accData[0];
  const worst = accData[accData.length - 1];
  const by3 = withCurve.map((g) => g.curve[2]);
  const day90 = withCurve.length ? withCurve.filter((g) => g.curve[2] >= 0.9).length : 0;

  if (!groups.length) {
    return (
      <article className="growth-table gcs">
        <h3>
          <FlaskConical size={16} /> Case study: คลิปใหม่จะได้วิวอีกเท่าไร และโตต่อนานแค่ไหน
        </h3>
        <p className="growth-hint">ยังมีคลิปใหม่ที่ครบ 7 วันไม่พอ (ต้องมีอย่างน้อย 30 คลิปต่อกลุ่ม) · ระบบจะคำนวณให้เองเมื่อมีข้อมูลรายวันมากขึ้น</p>
      </article>
    );
  }
  return (
    <article className="growth-table gcs">
      <h3>
        <FlaskConical size={16} /> Case study: คลิปใหม่จะได้วิวอีกเท่าไร และโตต่อนานแค่ไหน
      </h3>
      <p className="growth-hint">
        คำนวณจากข้อมูลจริง {num(study.clips)} คลิปใหม่ (ทุกรายการ) ที่โพสต์ {thDate(study.firstPosted)} – {thDate(study.lastPosted)} และมีข้อมูลครบ 7 วัน ·
        เทียบเฉพาะแพลตฟอร์มและรูปแบบเดียวกัน · ทุกคลิปถูกทายจากคลิปอื่นในกลุ่ม แล้วเทียบกับยอดจริง · อัปเดตเองทุกวันเมื่อมีข้อมูลเพิ่ม
      </p>

      <div className="gcs-kpis">
        <div>
          <small>ทายยอด 7 วันจากวิววันแรก ถูกในช่วง ±30%</small>
          <b>{pct(study.hitRate)}</b>
          <span>ของคลิป · คลาดเคลื่อนโดยทั่วไป {pct(study.medianError)}</span>
        </div>
        <div>
          <small>ได้วิว 90% ของ 10 วันแรกภายใน 3 วัน</small>
          <b>
            {day90}/{withCurve.length}
          </b>
          <span>กลุ่ม · ค่ากลาง {by3.length ? pct(by3.sort((a, b) => a - b)[Math.floor(by3.length / 2)]) : "-"} ภายในวันที่ 3</span>
        </div>
        <div>
          <small>โตต่อนานที่สุด</small>
          <b>{slowest ? groupLabel(slowest) : "-"}</b>
          <span>{slowest?.fadeDay ? `ถึงราววันที่ ${slowest.fadeDay} หลังโพสต์` : ""}</span>
        </div>
      </div>

      <div className="gcs-charts">
        <div>
          <h4>วิวสะสมตามวันหลังโพสต์ (% ของยอด 10 วัน)</h4>
          <p className="growth-hint">เส้นที่ขึ้นเร็วแล้วแบน = ได้วิวเกือบหมดในไม่กี่วัน · เส้นประ = โพสต์ (ไม่ใช่วิดีโอสั้น)</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tickFormatter={(d) => `วันที่ ${d}`} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={44} />
              <Tooltip formatter={(v, n) => [`${v}%`, String(n)]} labelFormatter={(d) => `วันที่ ${d} หลังโพสต์`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {withCurve.map((g) => (
                <Line
                  key={g.key}
                  type="monotone"
                  dataKey={groupLabel(g)}
                  stroke={COLORS[g.platform] || "#64748b"}
                  strokeWidth={2.2}
                  strokeDasharray={isPost(g) ? "5 4" : undefined}
                  dot={false}
                  isAnimationActive={motion}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h4>ทายยอด 7 วันถูกแค่ไหน (ช่วง ±30%)</h4>
          <p className="growth-hint">ตัวเลขท้ายแท่ง = วิว 7 วันโดยเฉลี่ยกี่เท่าของวันแรก</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={accData} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}% ของคลิปทายถูก`, "ความแม่น"]} />
              <Bar dataKey="hit" radius={[0, 4, 4, 0]} isAnimationActive={motion}>
                {accData.map((d) => (
                  <Cell key={d.name} fill={COLORS[d.g.platform] || "#64748b"} fillOpacity={isPost(d.g) ? 0.55 : 1} />
                ))}
                <LabelList dataKey="hit" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: "#334155" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>กลุ่ม</th>
              <th className="num">คลิป</th>
              <th className="num" title="ยอด 7 วัน ÷ วิววันแรก (ค่ากลาง)">ยอด 7 วัน = วันแรก ×</th>
              <th className="num" title="ครึ่งกลางของคลิปทั้งหมด">ช่วงปกติ</th>
              <th className="num">ทายถูก ±30%</th>
              <th className="num" title="วันที่วิวที่เพิ่มต่ำกว่า 5% ของวันแรก">โตต่อถึงราว</th>
              <th className="num">วันแรก / วันที่ 3 / วันที่ 7</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td>
                  <span className="gcs-dot" style={{ background: COLORS[g.platform] || "#64748b" }} />
                  {groupLabel(g)}
                </td>
                <td className="num">{num(g.clips)}</td>
                <td className="num strong">×{g.multiplier.toFixed(2)}</td>
                <td className="num">
                  ×{g.low.toFixed(2)}–×{g.high.toFixed(2)}
                </td>
                <td className="num">{pct(g.hitRate)}</td>
                <td className="num">{g.fadeDay ? `วันที่ ${g.fadeDay}` : "–"}</td>
                <td className="num">{g.curve.length ? `${pct(g.curve[0])} / ${pct(g.curve[2])} / ${pct(g.curve[6])}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="gcs-findings">
        {fastest.length > 0 && byFade[0]?.fadeDay && (
          <li>
            <b>{fastest.join(", ")}</b> ได้วิวส่วนใหญ่ตั้งแต่วันแรก และหมดแรงราววันที่ {byFade[0].fadeDay} · ถ้าวันแรกไม่แรง โอกาสตามทีหลังน้อย
          </li>
        )}
        {slowest?.fadeDay && slowest.fadeDay !== byFade[0]?.fadeDay && (
          <li>
            <b>{groupLabel(slowest)}</b> วันแรกได้แค่ {pct(slowest.curve[0])} ของยอด 10 วัน และโตต่อถึงราววันที่ {slowest.fadeDay} · ควรรอดูผล 2–3 วันก่อนตัดสิน
          </li>
        )}
        {best && worst && best !== worst && (
          <li>
            ทายแม่นที่สุด <b>{best.name}</b> ({best.hit}%) · ทายยากที่สุด <b>{worst.name}</b> ({worst.hit}%) เพราะบางคลิปมาแรงทีหลัง
          </li>
        )}
        <li>
          ตัวอย่าง: คลิป {groupLabel(groups[0])} ที่วันแรกได้ 100K คาดว่าครบ 7 วันจะได้ราว {num(Math.round(100 * groups[0].multiplier))}K (ช่วงปกติ{" "}
          {num(Math.round(100 * groups[0].low))}K–{num(Math.round(100 * groups[0].high))}K)
        </li>
      </ul>
      <p className="audience-note">
        เป็นการคาดการณ์จากสถิติในอดีต ไม่ได้รับประกันผล · ใช้เฉพาะกลุ่มที่มีอย่างน้อย 30 คลิปที่ครบ 7 วัน
        {study.shortDays.length > 0 && ` · วันที่ ${study.shortDays.map(thDate).join(", ")} ข้อมูลเก็บมาไม่ครบ วิวของวันนั้นนับรวมกับวันถัดไป`}
      </p>
    </article>
  );
}
