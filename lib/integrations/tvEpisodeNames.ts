// Episode names for TV tabs that have none (เงินทองของจริง's Nielsen exports): the name of
// the day's own clips of that program in masterData. First the YouTube FULL EP, then a
// full-length YouTube video that is not a highlight, then the morning LIVE (YouTube, then
// Facebook). The note on the TV row says where the name came from and how many clips the
// program posted that day, per platform.
//
// Relative imports only: the sync runs this file directly with Node.
import { classifyTopic } from "../dashboard/topicRules.ts";
import type { TvEpisode } from "./tvSheet.ts";

type Row = Record<string, unknown>;

const PLATFORMS = ["YouTube", "Facebook", "Instagram", "TikTok"];
const text = (v: unknown) => String(v ?? "");

/** "🔴 [LIVE] ครม.ไฟเขียว ! … | เงินทองของจริง | วันที่ 28 ตุลาคม" → "ครม.ไฟเขียว ! …". */
export function episodeTitle(title: unknown): string {
  return text(title)
    .replace(/🔴\s*\[LIVE\]\s*/i, "")
    .replace(/^\s*\[Highlight\]\s*\|?\s*/i, "")
    .split("|")[0]
    .replace(/\s+/g, " ")
    .trim();
}

export interface DayName {
  topic: string;
  episodeId: string;
  /** "YouTube FULL EP", "YouTube LIVE", … or "" when no clip names it. */
  from: string;
  clips: Record<string, number>;
  total: number;
}

/** The name of `program`'s episode on `date`, from that day's clips (digital rows). */
export function nameFromClips(rows: Row[], program: string, date: string): DayName {
  const day = rows.filter((r) => r.Platform !== "TV" && r.Program === program && text(r.Date).slice(0, 10) === date);
  const clips = Object.fromEntries(PLATFORMS.map((p) => [p, day.filter((r) => r.Platform === p).length]));
  const yt = day.filter((r) => r.Platform === "YouTube");
  const highlight = (r: Row) => /\[Highlight\]|#shorts/i.test(text(r.Topic));
  const live = (r: Row) => /\[LIVE\]/i.test(text(r.Topic)) || /live/i.test(text(r.VDO_Type));
  const candidates: [string, Row | undefined][] = [
    ["YouTube FULL EP", yt.find((r) => /full\s*ep/i.test(text(r.Topic)))],
    ["YouTube คลิปเต็ม", yt.find((r) => !highlight(r) && !live(r) && /full episode|video episode/i.test(text(r.VDO_Type)))],
    ["YouTube LIVE", yt.find((r) => live(r) && episodeTitle(r.Topic))],
    ["Facebook LIVE", day.find((r) => r.Platform === "Facebook" && /\[LIVE\]/i.test(text(r.Topic)) && episodeTitle(r.Topic))],
  ];
  for (const [from, r] of candidates) {
    const topic = r ? episodeTitle(r.Topic) : "";
    if (!topic) continue;
    const ep = from === "YouTube FULL EP" ? text(r!.Topic).match(/EP\.?\s*(\d+)/i) : null;
    return { topic, episodeId: ep ? `EP.${ep[1]}` : "", from, clips, total: day.length };
  }
  return { topic: "", episodeId: "", from: "", clips, total: day.length };
}

/** "คลิปวันนั้น 18 (YouTube 5 · Facebook 8 · Instagram 3 · TikTok 2)". */
export function clipNote(n: DayName): string {
  const parts = PLATFORMS.filter((p) => n.clips[p]).map((p) => `${p} ${n.clips[p]}`);
  return n.total ? `คลิปวันนั้น ${n.total} (${parts.join(" · ")})` : "ยังไม่พบคลิปของวันนั้น";
}

/**
 * Name every episode that has no name, from the day's clips. The day's clip count goes in
 * the note either way, so a day still waiting for its clips gets named on a later run.
 */
export function nameEpisodes(episodes: TvEpisode[], rows: Row[]): { named: number; waiting: string[] } {
  let named = 0;
  const waiting: string[] = [];
  for (const e of episodes) {
    if (e.topic) continue;
    const n = nameFromClips(rows, e.program, e.date);
    e.named = true;
    e.topic = n.topic;
    e.episodeId = n.episodeId;
    e.topicType = n.topic ? classifyTopic(n.topic, "", e.program) : "";
    e.notes = [`TV rating workbook (${e.channel})`, n.from ? `ชื่อตอนจาก ${n.from}` : "ยังไม่มีชื่อตอน", clipNote(n)].join(" · ");
    if (n.topic) named++;
    else waiting.push(`${e.date} ${e.channel}`);
  }
  return { named, waiting };
}
