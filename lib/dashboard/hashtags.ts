// Hashtags of a post (title / caption / YouTube description), stored in
// masterData "Hashtags" as "#a #b". Thai tags keep their vowel and tone marks.
//
// Relative imports only: the sync runs this file directly with Node.

/** "#" then letters (any script, with their marks), digits or "_". */
const TAG = /#[\p{L}\p{M}\p{N}_]+/gu;

/** Unique tags in the order they first appear; Latin letters in lower case. */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of String(text || "").matchAll(TAG)) {
    const tag = m[0].toLowerCase();
    if (tag.length < 3 || /^#\d+$/.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** The masterData value: "#a #b" (empty when none). */
export const hashtagsField = (text: string) => extractHashtags(text).join(" ");

/** Tags from the stored "#a #b" value. */
export const parseHashtags = (value: unknown) => String(value ?? "").split(/\s+/).filter((t) => t.startsWith("#"));
