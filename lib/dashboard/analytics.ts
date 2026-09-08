import type { RecordRow } from "@/lib/dashboard/types";

export function sumBy<T>(
  rows: T[],
  key: (r: T) => string,
  value: (r: T) => number,
) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) || 0) + value(r)));
  return [...m].map(([name, total]) => ({ name, total }));
}

export function presenter(program: string) {
  return program === "ถกไม่เถียง" ? "ทิน โชคกมลกิจ" : "";
}

export function explicitGuest(topic: string) {
  const match = topic.match(
    /(?:แขกรับเชิญ|ผู้ร่วมรายการ|สัมภาษณ์|พูดคุยกับ|พบกับ)\s*[:：\-]?\s*([^|#,!?ฯ\n]{2,60})/i,
  );
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

export function bestFormat(rows: RecordRow[]) {
  const grouped = new Map<
    string,
    { name: string; views: number; engagement: number; count: number }
  >();
  rows.forEach((r) => {
    const x = grouped.get(r.vdoType) || {
      name: r.vdoType,
      views: 0,
      engagement: 0,
      count: 0,
    };
    x.views += r.views;
    x.engagement += r.engagement;
    x.count++;
    grouped.set(r.vdoType, x);
  });
  return [...grouped.values()]
    .filter((x) => x.count >= 3)
    .map((x) => ({
      ...x,
      avgViews: x.views / x.count,
      rate: x.views ? x.engagement / x.views : 0,
    }))
    .sort(
      (a, b) => b.avgViews * (1 + b.rate * 5) - a.avgViews * (1 + a.rate * 5),
    )[0];
}

export function normalizedTopic(value: string) {
  return value
    .toLowerCase()
    .split("#")[0]
    .replace(/[^a-z0-9ก-๙]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicSimilarity(a: string, b: string) {
  const left = normalizedTopic(a),
    right = normalizedTopic(b);
  if (!left || !right) return 0;
  if (left === right || left.includes(right) || right.includes(left)) return 1;
  const grams = (text: string) => {
      const compactText = text.replaceAll(" ", "");
      const set = new Set<string>();
      for (let i = 0; i < compactText.length - 2; i++)
        set.add(compactText.slice(i, i + 3));
      return set;
    },
    x = grams(left),
    y = grams(right);
  if (!x.size || !y.size) return 0;
  let common = 0;
  x.forEach((g) => {
    if (y.has(g)) common++;
  });
  return (2 * common) / (x.size + y.size);
}
