// Reads ytAnalytics/* (written by the sync, admins only) for the YouTube Deep Dive page.
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { YtDeepDiveData, YtVideo } from "@/lib/dashboard/ytDeepDive";

let cached: Promise<YtDeepDiveData | null> | null = null;

/** Everything in one read of the collection, once per session; null before the first sync wrote it. */
export function loadYtAnalytics(): Promise<YtDeepDiveData | null> {
  cached ||= getDocs(collection(db, "ytAnalytics"))
    .then((snap) => {
      const docs = new Map(snap.docs.map((d) => [d.id, d.data()]));
      const meta = docs.get("meta");
      if (!meta) return null;
      const videos: YtVideo[] = [];
      for (const [id, d] of [...docs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) if (id.startsWith("videos_")) videos.push(...((d.rows || []) as YtVideo[]));
      return {
        updatedAt: String(meta.updatedAt || ""),
        videos,
        windows: (docs.get("channel")?.windows as YtDeepDiveData["windows"]) || null,
        retention: (docs.get("retention")?.videos as YtDeepDiveData["retention"]) || [],
        search: (docs.get("search")?.videos as YtDeepDiveData["search"]) || {},
      };
    })
    .catch((e) => {
      cached = null;
      throw e;
    });
  return cached;
}
