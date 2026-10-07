// Cover-image links for the thumbnail page: thumbnails/{platform} = gzipped
// JSON { "Platform|postId": url }, split into thumbnails/{platform}__1, __2 …
// when one document would be too big (the first one says how many parts).
// Kept out of masterData so the dashboard stays light. YouTube needs none
// (the link is built from the video id).
//
// - TikTok covers are hosted by Metricool and do not expire: kept and added to.
// - Facebook / Instagram links are Meta CDN links that expire after a few days
//   (the "oe" parameter): each sync refreshes the posts it fetched and drops
//   links that have expired.
import { gunzipSync, gzipSync } from "node:zlib";
import type { Network, Post } from "./metricoolSync.ts";
import type { Firestore } from "./firestoreRest.ts";

const FIELD: Partial<Record<Network, string>> = {
  facebook: "picture",
  fbreels: "thumbnailUrl",
  instagram: "imageUrl",
  reels: "imageUrl",
  tiktok: "coverImageUrl",
};

/** The cover link the API gave for a post, or "" (YouTube and posts without one). */
export function thumbOf(network: Network, post: Post): string {
  const field = FIELD[network];
  const url = field ? String(post[field] ?? "").trim() : "";
  return /^https:\/\//.test(url) ? url : "";
}

/** Meta links carry their expiry as hex unix seconds in "oe"; others never expire. */
export function expiresAt(url: string): number {
  try {
    const oe = new URL(url).searchParams.get("oe");
    return oe ? parseInt(oe, 16) * 1000 : Infinity;
  } catch {
    return 0;
  }
}

/** Old links + fresh ones (fresh win), without expired links or posts no longer in masterData. */
export function mergeThumbs(
  old: Record<string, string>,
  fresh: Record<string, string>,
  keep: (key: string) => boolean,
  now = Date.now(),
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, url] of Object.entries({ ...old, ...fresh })) {
    if (keep(k) && expiresAt(url) > now) out[k] = url;
  }
  return out;
}

const MAX_BYTES = 900_000;
const MAX_PARTS = 20;

const unzip = (doc: { fields?: Record<string, unknown> } | null): Record<string, string> => {
  const f = doc?.fields?.data as { bytesValue?: string } | undefined;
  return f?.bytesValue ? (JSON.parse(gunzipSync(Buffer.from(f.bytesValue, "base64")).toString("utf8")) as Record<string, string>) : {};
};

/** Links split into gzipped parts that each fit in a document. */
export function packThumbs(links: Record<string, string>, maxBytes = MAX_BYTES): Buffer[] {
  const entries = Object.entries(links);
  for (let parts = 1; parts <= MAX_PARTS; parts++) {
    const size = Math.ceil(entries.length / parts) || 1;
    const out: Buffer[] = [];
    for (let i = 0; i < Math.max(1, entries.length); i += size) out.push(gzipSync(JSON.stringify(Object.fromEntries(entries.slice(i, i + size))), { level: 9 }));
    if (out.every((b) => b.length <= maxBytes)) return out;
  }
  throw new Error(`cover links do not fit in ${MAX_PARTS} documents`);
}

/** Write each platform's links (in parts when needed). Analysis only: callers must not fail a run on errors here. */
export async function writeThumbnails(
  db: Firestore,
  fresh: Map<string, string>,
  keep: (key: string) => boolean,
): Promise<Record<string, number>> {
  const byPlatform: Record<string, Record<string, string>> = { Facebook: {}, Instagram: {}, TikTok: {} };
  for (const [key, url] of fresh) {
    const p = key.split("|")[0];
    if (byPlatform[p]) byPlatform[p][key] = url;
  }
  const counts: Record<string, number> = {};
  for (const [platform, links] of Object.entries(byPlatform)) {
    const path = `thumbnails/${platform}`;
    const existing = await db.get(path);
    const oldParts = Number((existing?.fields?.parts as { integerValue?: string } | undefined)?.integerValue || 1);
    const old = unzip(existing);
    for (let i = 1; i < oldParts; i++) Object.assign(old, unzip(await db.get(`${path}__${i}`)));
    const merged = mergeThumbs(old, links, keep);
    const parts = packThumbs(merged);
    const updatedAt = new Date().toISOString();
    for (let i = parts.length - 1; i >= 0; i--) {
      // Extra parts first, the first document last: a reader never sees a part count whose parts are missing.
      await db.set(i ? `${path}__${i}` : path, {
        platform: { stringValue: platform },
        ...(i ? { part: { integerValue: String(i) } } : { parts: { integerValue: String(parts.length) }, count: { integerValue: String(Object.keys(merged).length) } }),
        updatedAt: { stringValue: updatedAt },
        data: { bytesValue: parts[i].toString("base64") },
      });
    }
    for (let i = parts.length; i < oldParts; i++) await db.delete(`${path}__${i}`);
    counts[platform] = Object.keys(merged).length;
  }
  return counts;
}
