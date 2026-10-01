// One key per post ("Platform|postId"), shared by the sync (matching API posts
// to masterData rows) and the dashboard (matching daily growth to rows).
// Pure functions only: no imports, so Node scripts and the browser can both use it.

/** Stable post id taken from a URL or id field, per platform. */
export function postId(platform: string, value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const m =
    (platform === "YouTube" && s.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([\w-]{11})/)) ||
    (platform === "TikTok" && s.match(/(?:video|photo)\/(\d{15,})/)) ||
    (platform === "Instagram" && s.match(/\/(?:reel|reels|p|tv)\/([\w-]+)/)) ||
    (platform === "Facebook" && (s.match(/(?:videos|posts|reel)\/(\d{8,})/) || s.match(/(?:fbid|story_fbid|v)=(\d{8,})/) || s.match(/_(\d{8,})$/)));
  if (m) return m[1];
  // Bare ids only; placeholders like "-" (TV rows) are not posts.
  return /^[\w-]{5,}$/.test(s) && /\w/.test(s) ? s : "";
}

export function rowKey(row: { Platform?: unknown; URL?: unknown; Content_ID?: unknown }): string {
  const platform = String(row.Platform ?? "");
  const id = postId(platform, row.URL) || postId(platform, row.Content_ID);
  return id ? `${platform}|${id}` : "";
}
