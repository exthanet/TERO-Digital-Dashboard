import type { RawRow, RecordRow } from "@/lib/dashboard/types";

export const n = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const text = String(v ?? "").trim(),
    isPercent = text.includes("%"),
    x = Number(text.replaceAll(",", "").replace("%", ""));
  return Number.isFinite(x) ? (isPercent ? x / 100 : x) : 0;
};

export const s = (v: unknown) => String(v ?? "").trim();

export const pick = (r: RawRow, ...keys: string[]) => {
  for (const key of keys)
    if (r[key] !== undefined && r[key] !== null && r[key] !== "") return r[key];
  return null;
};

export const excelDate = (v: unknown) => {
  if (!v) return "";
  if (typeof v === "object" && v !== null) {
    if ("toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
      const d = (v as { toDate: () => Date }).toDate();
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if ("seconds" in v && typeof (v as { seconds: number }).seconds === "number") {
      const d = new Date((v as { seconds: number }).seconds * 1000);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
  }
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Check if it's unix timestamp in seconds or ms
    if (v > 1000000000000) {
      return new Date(v).toISOString().slice(0, 10);
    }
    if (v > 1000000000) {
      return new Date(v * 1000).toISOString().slice(0, 10);
    }
    // Excel serial date
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const t = s(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) {
    let year = Number(m[3]);
    if (year > 2400) year -= 543; // Handle Buddhist Era years (e.g. 2569 -> 2026)
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const parsed = new Date(t);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

export const normalizeVdoType = (v: string, p: string) => {
  const t = v.toLowerCase();
  if (p === "TV" || t.includes("tv")) return "TV Episode";
  if (t.includes("live")) return p === "YouTube" ? "YouTube Live" : `${p} Live`;
  if (t.includes("short")) return "YouTube Shorts";
  if (t.includes("highlight")) return "YouTube Highlight";
  if (p === "YouTube" && (t.includes("full") || t.includes("episode")))
    return "YouTube Full Episode";
  if (t.includes("reel")) return "Facebook/IG Reels";
  if (p === "TikTok") return "TikTok";
  if (p === "YouTube" && t.includes("video")) return "YouTube Highlight";
  return v || "Other";
};

export const normalizeTopic = (v: string) => {
  const x = v.toLowerCase();
  if (!x) return "ไม่ระบุประเภท";
  if (x.includes("กัมพูชา")) return "ข่าวไทย–กัมพูชา";
  if (x.includes("อิหร่าน") || x.includes("สหรัฐ") || x.includes("ต่างประเทศ"))
    return "ข่าวต่างประเทศ / อิหร่าน–สหรัฐ";
  if (x.includes("ตำรวจ") || x.includes("อาชญากรรม") || x.includes("สแกม"))
    return "ข่าวตำรวจ / อาชญากรรม / สแกมเมอร์";
  if (x.includes("กระแส") || x.includes("viral")) return "ข่าวกระแส / Viral";
  if (x.includes("ชาวบ้าน")) return "ข่าวชาวบ้าน";
  if (x.includes("ผู้ว่า") || x.includes("บิ๊กโจ๊ก") || x.includes("บุคคล"))
    return "ข่าวบุคคล / การเมืองท้องถิ่น";
  if (x.includes("ประวัติศาสตร์")) return "ประวัติศาสตร์";
  if (x.includes("พระเครื่อง")) return "พระเครื่อง";
  if (x.includes("ลูกค้า") || x.includes("งานขอ") || x.includes("branded"))
    return "งานลูกค้า / Branded Content";
  if (x.includes("การเมือง")) return "ข่าวการเมือง";
  return v;
};

export function normalize(r: RawRow): RecordRow {
  const raw = s(pick(r, "Platform", "platform"));
  const channel = s(pick(r, "Channel", "channel", "Page Name", "page-name"));
  const platform =
    raw ||
    (channel.toLowerCase().includes("one") ||
    channel.toLowerCase().includes("gmm")
      ? "TV"
      : "Other");
  const views = n(pick(r, "Views", "views", "View"));
  const likes = n(pick(r, "Likes", "likes", "Like"));
  const comments = n(pick(r, "Comments", "comments"));
  const shares = n(pick(r, "Shares", "shares", "Share"));
  const engagement =
    n(pick(r, "Engagement", "engagement")) || likes + comments + shares;
  const rate = n(
    pick(r, "Engagement_Rate", "Engagement Rate", "engagement_rate"),
  );
  const notes = s(pick(r, "Notes", "notes"));
  const gmmRating = n(notes.match(/GMM Rating:\s*([\d,.]+)/i)?.[1]);
  const gmmAudience = n(notes.match(/GMM Audience:\s*([\d,]+)/i)?.[1]);
  const sourceAudience = n(pick(r, "TV_Audience_Total"));
  return {
    date: excelDate(pick(r, "Date", "date", "Publish Date")),
    program: s(pick(r, "Program", "รายการ", "program")) || "ไม่ระบุรายการ",
    episodeId: s(pick(r, "Episode_ID", "Episode ID")),
    topic: s(pick(r, "Topic", "ประเด็น", "Video title")),
    topicType: normalizeTopic(
      s(pick(r, "Topic_Type", "Topic Type", "ประเภทเนื้อหา")),
    ),
    vdoType: normalizeVdoType(
      s(pick(r, "VDO_Type", "VDO Type", "video type")),
      platform,
    ),
    platform,
    channel,
    province: s(pick(r, "Province", "จังหวัด", "province")),
    contentId: s(pick(r, "Content_ID", "Content", "Video ID")),
    url: s(pick(r, "URL", "Url")),
    durationMin: n(pick(r, "Duration_Min", "Duration Min")),
    views,
    likes,
    comments,
    shares,
    engagement,
    engagementRate: rate || (views ? engagement / views : 0),
    ratingTotal: n(pick(r, "TV_Rating_Total", "Rating Total")),
    ratingBkk: n(pick(r, "TV_Rating_15+BKK")),
    ratingUrban: n(pick(r, "TV_Rating_15+URBAN")),
    ratingBkkUrban: n(pick(r, "TV_Rating_15+BKK&URBAN")),
    ratingRural: n(pick(r, "TV_Rating_15+RURAL")),
    audienceTotal: sourceAudience || (platform === "TV" ? views : 0),
    gmmRating,
    gmmAudience,
    bestOfMonth: s(pick(r, "Best_of_Month", "Best of Month")),
    uploadCount: n(pick(r, "Upload_Count")) || 1,
    revenue: n(pick(r, "Revenue", "Estimated revenue (THB)")),
  };
}

/**
 * Normalizes an array of raw rows and deduplicates TV rows by Date + Program so each broadcast episode is counted exactly once with merged One31 + GMM25 ratings.
 */
export function normalizeRowsWithDeduplication(rawRows: RawRow[]): RecordRow[] {
  const normalized = rawRows.map(normalize).filter((r) => r.date);
  const digitalRows: RecordRow[] = [];
  const tvByDateAndProgram = new Map<string, RecordRow[]>();

  for (const row of normalized) {
    if (row.platform === "TV" || row.ratingTotal > 0 || row.gmmRating > 0) {
      const key = `${row.date}_${row.program || "ถกไม่เถียง"}`;
      if (!tvByDateAndProgram.has(key)) {
        tvByDateAndProgram.set(key, []);
      }
      tvByDateAndProgram.get(key)!.push(row);
    } else {
      digitalRows.push(row);
    }
  }

  const mergedTvRows: RecordRow[] = [];
  for (const [, list] of tvByDateAndProgram.entries()) {
    // Prefer row with ONE31 main rating if available, else first row
    const one31Row = list.find((r) => r.ratingTotal > 0);
    const gmmRow = list.find((r) => r.gmmRating > 0 || /gmm/i.test(r.channel));
    const base = one31Row || list[0];

    const gmmRating = gmmRow ? (gmmRow.gmmRating || gmmRow.ratingTotal) : base.gmmRating;
    const gmmAudience = gmmRow ? (gmmRow.gmmAudience || gmmRow.audienceTotal) : base.gmmAudience;

    mergedTvRows.push({
      ...base,
      platform: "TV",
      channel: base.channel || "ONE31",
      ratingTotal: base.ratingTotal || 0,
      audienceTotal: base.audienceTotal || 0,
      gmmRating: gmmRating || 0,
      gmmAudience: gmmAudience || 0,
    });
  }

  return [...digitalRows, ...mergedTvRows];
}

