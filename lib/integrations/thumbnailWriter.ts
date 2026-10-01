// Cover-image links for the thumbnail page: thumbnails/{platform} = gzipped
// JSON { "Platform|postId": url }. Kept out of masterData so the dashboard
// stays light. YouTube needs none (the link is built from the video id).
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

/** Write one document per platform. Analysis only: callers must not fail a run on errors here. */
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
    const bytes = existing?.fields?.data && "bytesValue" in existing.fields.data ? String(existing.fields.data.bytesValue) : "";
    const old = bytes ? (JSON.parse(gunzipSync(Buffer.from(bytes, "base64")).toString("utf8")) as Record<string, string>) : {};
    const merged = mergeThumbs(old, links, keep);
    const data = gzipSync(JSON.stringify(merged), { level: 9 });
    if (data.length > MAX_BYTES) throw new Error(`${path} is ${data.length} bytes, over the document limit`);
    await db.set(path, {
      platform: { stringValue: platform },
      count: { integerValue: String(Object.keys(merged).length) },
      updatedAt: { stringValue: new Date().toISOString() },
      data: { bytesValue: data.toString("base64") },
    });
    counts[platform] = Object.keys(merged).length;
  }
  return counts;
}
