// Reads tvCompetitors/{sourceId} (written by the sync from the TV workbook).
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CompetitorRow } from "@/lib/dashboard/competitors";

export interface CompetitorSource {
  sourceId: string;
  name: string;
  program: string;
  /** "One31" or "GMM25". */
  channel: string;
  rows: CompetitorRow[];
}

let cached: Promise<CompetitorSource[]> | null = null;

/** Every source's competitor rows (one read per TV source, once per session). */
export function loadTvCompetitors(): Promise<CompetitorSource[]> {
  cached ||= getDocs(collection(db, "tvCompetitors"))
    .then((snap) =>
      snap.docs.map((d) => {
        const x = d.data();
        return {
          sourceId: d.id,
          name: String(x.name || d.id),
          program: String(x.program || ""),
          channel: String(x.channel || ""),
          rows: (Array.isArray(x.rows) ? x.rows : []) as CompetitorRow[],
        };
      }),
    )
    .catch((e) => {
      cached = null;
      throw e;
    });
  return cached;
}
