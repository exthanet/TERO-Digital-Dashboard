// รายงานรายเดือน → "5 คลิปดีที่สุด / แย่ที่สุด": the plain-language reasons under
// each clip, from numbers worked out elsewhere (ranking.ts, clipDetail.ts). Only
// says what the numbers show; no guesses about why.
//
// Relative imports only: tests run this file directly with Node.

export interface PickFacts {
  kind: "best" | "worst";
  /** Views ÷ normal for the same platform + format (or as many platforms); null without a baseline. */
  index: number | null;
  baseline: number | null;
  /** Views per platform, most first. */
  platforms: { platform: string; views: number }[];
  /** Engagement ÷ views of the content, and the month's median over clips. */
  er: number;
  erMedian: number | null;
  /** The lead post: its posting hour and the best hour of its platform + format (90 days). */
  hour: number | null;
  bestHour: number | null;
  platform: string;
  vdoType: string;
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const kfmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(Math.round(v)));

/** Up to four short lines: against normal, platforms, engagement, posting time. */
export function pickReasons(f: PickFacts): string[] {
  const out: string[] = [];
  if (f.index !== null && f.baseline) {
    out.push(
      f.index >= 1
        ? `วิวสูงกว่าปกติ ${f.index.toFixed(1)} เท่า (ปกติ ≈ ${kfmt(f.baseline)})`
        : `ได้ ${Math.round(f.index * 100)}% ของปกติ (ปกติ ≈ ${kfmt(f.baseline)})`,
    );
  }
  const total = f.platforms.reduce((a, p) => a + p.views, 0);
  if (f.platforms.length > 1 && total > 0) out.push(`ลง ${f.platforms.length} แพลตฟอร์ม · ${f.platforms[0].platform} ทำวิวมากสุด ${pct(f.platforms[0].views / total, 0)}`);
  else if (f.platforms.length === 1) out.push(`ลงแพลตฟอร์มเดียว (${f.platforms[0].platform})`);
  if (f.erMedian !== null && f.erMedian > 0) {
    const higher = f.er >= f.erMedian;
    out.push(`ER ${pct(f.er)} ${higher ? "สูงกว่า" : "ต่ำกว่า"}ค่ากลางของเดือน (${pct(f.erMedian)})`);
  }
  // The format alone when it already names the platform ("Facebook/IG Reels", not "Facebook Facebook/IG Reels").
  const group = !f.vdoType || f.vdoType === f.platform ? f.platform : f.vdoType.toLowerCase().startsWith(f.platform.toLowerCase()) ? f.vdoType : `${f.platform} ${f.vdoType}`;
  if (f.hour !== null && f.bestHour !== null) {
    out.push(
      f.hour === f.bestHour
        ? `โพสต์ ${hh(f.hour)} ตรงช่วงที่ดีที่สุดของ ${group}`
        : `โพสต์ ${hh(f.hour)} · ช่วงที่ดีที่สุดของ ${group} คือ ${hh(f.bestHour)}`,
    );
  } else if (f.hour === null) out.push("ไม่มีเวลาโพสต์ในข้อมูล");
  return out.slice(0, 4);
}

/** "ข่าวการเมือง" when it is at least 3 of the 5; else null. */
export function commonTopic(types: string[]): string | null {
  const m = new Map<string, number>();
  for (const t of types) if (t) m.set(t, (m.get(t) || 0) + 1);
  const top = [...m].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 3 ? top[0] : null;
}
