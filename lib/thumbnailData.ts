// Reads thumbnails/{platform} (see lib/integrations/thumbnailWriter.ts) for the thumbnail page.
import { Bytes, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

let cached: Promise<Map<string, string>> | null = null;

/** Every stored cover link by post key (one read per platform, more when split; once per session). YouTube links are built, not stored. */
export function loadThumbnails(): Promise<Map<string, string>> {
  cached ||= (async () => {
    const out = new Map<string, string>();
    for (const platform of ["Facebook", "Instagram", "TikTok"]) {
      const snap = await getDoc(doc(db, "thumbnails", platform));
      const data = snap.exists() ? snap.data() : null;
      if (!data?.data) continue;
      const docs = [data];
      for (let i = 1; i < (Number(data.parts) || 1); i++) {
        const part = await getDoc(doc(db, "thumbnails", `${platform}__${i}`));
        if (part.exists()) docs.push(part.data());
      }
      for (const d of docs) {
        const links = JSON.parse(await gunzip((d.data as Bytes).toUint8Array())) as Record<string, string>;
        for (const [k, v] of Object.entries(links)) out.set(k, v);
      }
    }
    return out;
  })().catch((e) => {
    cached = null;
    throw e;
  });
  return cached;
}

/** Cover link for a post key: YouTube from the video id, others from the stored links. */
export function thumbnailFor(key: string, stored: Map<string, string>): string {
  const [platform, id] = key.split("|");
  if (platform === "YouTube" && id) return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  return stored.get(key) || "";
}
