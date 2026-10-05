// One row per piece of content: the posts of the same clip on every platform,
// matched like the clip analysis panel (same programme, same title without
// hashtags, posted within 3 days of the first post). Views are added up as given.
//
// Relative imports only: tests run this file directly with Node.
import { SIBLING_DAYS, normTitle } from "./clipDetail.ts";
import type { RecordRow } from "./types.ts";

export interface ContentGroup {
  key: string;
  posts: RecordRow[];
  /** The post with the most views: its title, link and posting day stand for the group. */
  lead: RecordRow;
  /** Earliest posting day. */
  date: string;
  views: number;
  /** Views per platform (two posts on one platform are added), most first. */
  platforms: { platform: string; views: number }[];
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

function makeGroup(posts: RecordRow[]): ContentGroup {
  const byPlatform = new Map<string, number>();
  for (const p of posts) byPlatform.set(p.platform, (byPlatform.get(p.platform) || 0) + p.views);
  const lead = posts.reduce((a, b) => (b.views > a.views ? b : a));
  const date = posts.map((p) => p.date).sort()[0];
  return {
    key: `${lead.platform}|${lead.contentId || lead.url || lead.topic}|${date}`,
    posts,
    lead,
    date,
    views: posts.reduce((a, p) => a + p.views, 0),
    platforms: [...byPlatform.entries()].map(([platform, views]) => ({ platform, views })).sort((a, b) => b.views - a.views),
  };
}

/** Online posts grouped into content; posts without a title stay on their own. */
export function groupContents(rows: RecordRow[]): ContentGroup[] {
  const byTitle = new Map<string, RecordRow[]>();
  const alone: RecordRow[] = [];
  for (const r of rows) {
    if (r.platform === "TV" || !r.date) continue;
    const t = normTitle(r.topic);
    if (!t) alone.push(r);
    else byTitle.set(`${r.program}|${t}`, [...(byTitle.get(`${r.program}|${t}`) || []), r]);
  }
  const groups: ContentGroup[] = alone.map((r) => makeGroup([r]));
  for (const list of byTitle.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    let current: RecordRow[] = [];
    for (const r of list) {
      // A repost of the same title weeks later is new content.
      if (current.length && dayDiff(r.date, current[0].date) > SIBLING_DAYS) {
        groups.push(makeGroup(current));
        current = [];
      }
      current.push(r);
    }
    if (current.length) groups.push(makeGroup(current));
  }
  return groups;
}
