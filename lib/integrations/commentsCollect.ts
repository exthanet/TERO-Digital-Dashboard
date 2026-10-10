// Comments for the clip detail panel (วิเคราะห์คลิป → คอมเมนต์), written by the
// daily sync into comments/{Platform}_{postId}; read with the "advanced"
// permission (firestore.rules). Names and profile pictures are kept as the
// platform shows them publicly; pictures are links, never copied. 30 days kept.
//
// - YouTube: YouTube Data API commentThreads for the most viewed clips of the
//   last 30 days: most liked (one page by relevance, sorted by likes) and newest.
// - Facebook: Metricool Inbox (about the last 50 posts, no like counts), so the
//   newest are collected every day and kept per post.
//
// Relative imports only: the sync runs this file directly with Node.
import { postId } from "../dashboard/postKey.ts";
import { docId, encodeFields, decodeFields, type Firestore } from "./firestoreRest.ts";

export interface CommentItem {
  id: string;
  name: string;
  avatar: string;
  text: string;
  /** Likes on the comment; null where the platform does not say (Facebook via Metricool). */
  likes: number | null;
  /** ISO time of the comment. */
  at: string;
  /** Opens the comment (or its post) on the platform. */
  link: string;
}

export interface ClipComments {
  platform: "YouTube" | "Facebook";
  postId: string;
  updatedAt: string;
  /** Most liked first (YouTube only). */
  top: CommentItem[];
  /** Newest first. */
  latest: CommentItem[];
  /** Total comments on the clip as the platform counts them, when known. */
  total: number | null;
}

/** Kept per clip and list ("ทั้งหมด" shows these). */
export const MAX_PER_LIST = 100;
export const KEEP_DAYS = 30;
const MAX_TEXT = 600;

export const commentDocId = (platform: string, id: string) => `${platform}_${id}`.replace(/\//g, "_");

/** Text worth showing in "ล่าสุด": not just emoji, marks or a couple of letters. */
export function hasContent(text: string): boolean {
  const letters = text.replace(/[\s\p{P}\p{S}\p{Extended_Pictographic}‍️]/gu, "");
  return letters.length >= 3;
}

const clean = (t: unknown) => String(t ?? "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_TEXT);

// ---------- YouTube ----------

type YtThread = {
  id?: string;
  snippet?: {
    totalReplyCount?: number;
    topLevelComment?: { id?: string; snippet?: { authorDisplayName?: string; authorProfileImageUrl?: string; textOriginal?: string; textDisplay?: string; likeCount?: number; publishedAt?: string } };
  };
};

export function mapYoutubeThread(t: YtThread, videoId: string): CommentItem | null {
  const c = t.snippet?.topLevelComment;
  const s = c?.snippet;
  if (!c?.id || !s) return null;
  return {
    id: c.id,
    name: String(s.authorDisplayName || ""),
    avatar: String(s.authorProfileImageUrl || ""),
    text: clean(s.textOriginal ?? s.textDisplay),
    likes: Number(s.likeCount || 0),
    at: String(s.publishedAt || ""),
    link: `https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`,
  };
}

/** One page of comment threads; "disabled" when comments are off for the video. */
async function ytPage(apiKey: string, videoId: string, order: "relevance" | "time", fetcher: typeof fetch): Promise<CommentItem[] | "disabled"> {
  const u = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  for (const [k, v] of Object.entries({ part: "snippet", videoId, maxResults: "100", order, textFormat: "plainText", key: apiKey })) u.searchParams.set(k, v);
  const res = await fetcher(u, { signal: AbortSignal.timeout(30_000) });
  const body = (await res.json().catch(() => ({}))) as { items?: YtThread[]; error?: { message?: string; errors?: { reason?: string }[] } };
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason || "";
    if (reason === "commentsDisabled" || res.status === 404) return "disabled";
    // Quota and key problems stop the whole step (the message never carries the key).
    throw new Error(`YouTube comments ${res.status}${reason ? ` ${reason}` : ""}`);
  }
  return (body.items || []).map((t) => mapYoutubeThread(t, videoId)).filter((x): x is CommentItem => !!x && !!x.text);
}

/** Most liked and newest comments of one video (2 calls, 2 quota units). */
export async function youtubeComments(apiKey: string, videoId: string, total: number | null, fetcher: typeof fetch = fetch): Promise<ClipComments | null> {
  const liked = await ytPage(apiKey, videoId, "relevance", fetcher);
  if (liked === "disabled") return null;
  const newest = await ytPage(apiKey, videoId, "time", fetcher);
  return {
    platform: "YouTube",
    postId: videoId,
    updatedAt: new Date().toISOString(),
    top: [...liked].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || b.at.localeCompare(a.at)).slice(0, MAX_PER_LIST),
    latest: (newest === "disabled" ? [] : newest).filter((c) => hasContent(c.text)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_PER_LIST),
    total,
  };
}

// ---------- Facebook (Metricool Inbox) ----------

export type McThread = {
  id?: unknown;
  creationDate?: unknown;
  participants?: { id?: unknown; name?: unknown; imageProfileUrl?: unknown }[];
  root?: { id?: unknown; creationDate?: unknown; text?: unknown; properties?: { permalink?: unknown }; element?: { id?: unknown; link?: unknown; commentCount?: unknown } };
};

const isoOf = (v: unknown) => {
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
};

/** Metricool threads grouped by Facebook post id (from the post link). */
export function facebookFromInbox(threads: McThread[]): Map<string, { items: CommentItem[]; total: number | null }> {
  const out = new Map<string, { items: CommentItem[]; total: number | null }>();
  for (const t of threads) {
    const el = t.root?.element;
    const post = postId("Facebook", el?.link) || postId("Facebook", el?.id);
    const text = clean(t.root?.text);
    if (!post || !text) continue;
    const who = t.participants?.[0] || {};
    const item: CommentItem = {
      id: String(t.root?.id ?? t.id ?? ""),
      name: String(who.name || ""),
      avatar: String(who.imageProfileUrl || ""),
      text,
      likes: null,
      at: isoOf(t.root?.creationDate ?? t.creationDate),
      link: String(t.root?.properties?.permalink || el?.link || ""),
    };
    if (!item.id) continue;
    const g = out.get(post) || { items: [], total: Number.isFinite(Number(el?.commentCount)) ? Number(el?.commentCount) : null };
    g.items.push(item);
    out.set(post, g);
  }
  return out;
}

/** New Facebook comments on top of the ones kept: one per id, newest first, 30 days, at most MAX_PER_LIST. */
export function mergeLatest(kept: CommentItem[], fresh: CommentItem[], now = new Date()): CommentItem[] {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString();
  const byId = new Map<string, CommentItem>();
  for (const c of [...kept, ...fresh]) byId.set(c.id, c);
  return [...byId.values()]
    .filter((c) => !c.at || c.at >= cutoff)
    .filter((c) => hasContent(c.text))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_PER_LIST);
}

// ---------- the sync step ----------

/** A clip as the sync knows it (from masterData). */
export interface ClipRef {
  platform: string;
  id: string;
  /** Posting day, YYYY-MM-DD. */
  date: string;
  views: number;
  comments: number;
}

/** Most viewed YouTube clips posted in the last 30 days (and with comments). */
export const YOUTUBE_CLIPS = 100;

export async function collectComments(
  db: Firestore,
  clips: ClipRef[],
  opts: {
    today: string;
    youtubeKey?: string;
    facebookBlogs: number[];
    fetchFacebook?: (blogId: number) => Promise<McThread[]>;
    fetcher?: typeof fetch;
    now?: Date;
  },
): Promise<{ youtube: number; facebook: number; removed: number; problems: string[] }> {
  const problems: string[] = [];
  const from = new Date(Date.parse(`${opts.today}T00:00:00Z`) - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  let youtube = 0;
  if (opts.youtubeKey) {
    const seen = new Set<string>();
    const recent = clips
      .filter((c) => c.platform === "YouTube" && c.date >= from && c.comments > 0)
      .sort((a, b) => b.views - a.views)
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .slice(0, YOUTUBE_CLIPS);
    for (const c of recent) {
      try {
        const got = await youtubeComments(opts.youtubeKey, c.id, c.comments, opts.fetcher);
        if (!got) continue;
        await writeClipComments(db, got);
        youtube++;
      } catch (e) {
        problems.push(`YouTube: ${(e as Error).message}`);
        break; // quota or key: the rest would fail the same way
      }
    }
  } else problems.push("YouTube: ไม่มี YOUTUBE_API_KEY");

  let facebook = 0;
  if (opts.fetchFacebook) {
    for (const blogId of opts.facebookBlogs) {
      let threads: McThread[] = [];
      try {
        threads = await opts.fetchFacebook(blogId);
      } catch (e) {
        problems.push(`Facebook ${blogId}: ${String((e as Error).message).slice(0, 120)}`);
        continue;
      }
      for (const [post, g] of facebookFromInbox(threads)) {
        const kept = await readClipComments(db, "Facebook", post);
        await writeClipComments(db, {
          platform: "Facebook",
          postId: post,
          updatedAt: (opts.now || new Date()).toISOString(),
          top: [],
          latest: mergeLatest(kept?.latest || [], g.items, opts.now),
          total: g.total ?? kept?.total ?? null,
        });
        facebook++;
      }
    }
  }
  const removed = await cleanupComments(db, opts.now);
  return { youtube, facebook, removed, problems };
}

// ---------- Firestore ----------

export async function writeClipComments(db: Firestore, c: ClipComments): Promise<void> {
  await db.set(`comments/${commentDocId(c.platform, c.postId)}`, encodeFields(c as unknown as Record<string, unknown>));
}

export async function readClipComments(db: Firestore, platform: string, id: string): Promise<ClipComments | null> {
  const d = await db.get(`comments/${commentDocId(platform, id)}`);
  return d ? (decodeFields(d.fields || {}) as unknown as ClipComments) : null;
}

/** Clips whose comments were not refreshed for 30 days are removed (names only are read). */
export async function cleanupComments(db: Firestore, now = new Date()): Promise<number> {
  const cutoff = now.getTime() - KEEP_DAYS * 86400000;
  let removed = 0;
  for (const d of await db.listStamps("comments")) {
    if (d.updateTime && Date.parse(d.updateTime) < cutoff) {
      await db.delete(`comments/${docId(d.name)}`);
      removed++;
    }
  }
  return removed;
}
