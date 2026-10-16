// สถานะการ Sync → "แหล่งข้อมูลแต่ละบัญชี": for each brand and platform, whether the
// last run read it straight from the platform's API or still through Metricool,
// worked out from the run's `sources` (scripts/metricool-sync.mjs fetchStats).
//
// Relative imports only: tests run this file directly with Node.

export interface FetchStat {
  brand: string;
  network: string;
  fetched?: number;
  mapped?: number;
  /** tiktok-api only: "api" when the API rows were used, "metricool" after a fallback. */
  source?: string;
  error?: string;
}

/** api = straight from the platform · metricool = not on the API yet · fallback = API failed, Metricool used · error = nothing read. */
export type CellKind = "api" | "metricool" | "fallback" | "error" | "none";

export interface SourceCell {
  kind: CellKind;
  label: string;
  note: string;
  error?: string;
}

export const MATRIX_PLATFORMS = ["Facebook", "Instagram", "TikTok", "YouTube"] as const;
export type MatrixPlatform = (typeof MATRIX_PLATFORMS)[number];

const PLATFORM_OF: Record<string, MatrixPlatform> = {
  facebook: "Facebook",
  fbreels: "Facebook",
  instagram: "Instagram",
  reels: "Instagram",
  tiktok: "TikTok",
  "tiktok-api": "TikTok",
  youtube: "YouTube",
  "youtube-data-api": "YouTube",
  "youtube-analytics": "YouTube",
};

/** Metricool's answer for a network the brand has not connected: not a failure. */
const notConnected = (s: FetchStat) => /no \w+ connection for blog/i.test(s.error || "");
const clips = (n?: number) => `${(n || 0).toLocaleString("en-US")} คลิป`;

function cellOf(platform: MatrixPlatform, stats: FetchStat[]): SourceCell {
  const live = stats.filter((s) => !notConnected(s));
  if (!live.length) return { kind: "none", label: "–", note: "" };
  const metricool = live.filter((s) => !["tiktok-api", "youtube-data-api", "youtube-analytics"].includes(s.network));
  const metricoolError = metricool.find((s) => s.error)?.error;
  if (platform === "TikTok") {
    const api = live.find((s) => s.network === "tiktok-api");
    if (api) {
      if (api.source === "api") return { kind: "api", label: "TikTok API", note: clips(api.fetched), error: api.error || undefined };
      return { kind: "fallback", label: "API ใช้ไม่ได้", note: "ใช้ Metricool แทน", error: api.error || undefined };
    }
  }
  if (platform === "YouTube") {
    const api = live.find((s) => s.network === "youtube-data-api");
    if (api) {
      if (api.error) return { kind: "fallback", label: "API ใช้ไม่ได้", note: "ใช้ Metricool แทน", error: api.error };
      const analytics = live.find((s) => s.network === "youtube-analytics");
      const count = api.fetched ? clips(api.fetched) : "0 คลิปในช่วงนี้";
      return {
        kind: "api",
        label: "YouTube API",
        note: analytics ? `${count} · + Analytics${analytics.error ? " (ใช้ไม่ได้)" : ""}` : count,
        error: analytics?.error || undefined,
      };
    }
  }
  if (metricoolError && metricool.every((s) => s.error)) return { kind: "error", label: "ดึงไม่ได้", note: "Metricool", error: metricoolError };
  return { kind: "metricool", label: "Metricool", note: "", error: metricoolError };
}

export interface SourceMatrix {
  rows: { brand: string; cells: Record<MatrixPlatform, SourceCell> }[];
  /** Cells still through Metricool (not on an API yet), per platform. */
  notOnApi: Record<MatrixPlatform, number>;
  notOnApiTotal: number;
  /** Brands with YouTube on the API but without YouTube Analytics. */
  noAnalytics: string[];
  hasAnalytics: string[];
}

export function sourceMatrix(sources: FetchStat[] | undefined): SourceMatrix | null {
  if (!sources?.length) return null;
  const brands = [...new Set(sources.map((s) => s.brand))];
  const rows = brands.map((brand) => {
    const mine = sources.filter((s) => s.brand === brand);
    const cells = Object.fromEntries(
      MATRIX_PLATFORMS.map((p) => [p, cellOf(p, mine.filter((s) => PLATFORM_OF[s.network] === p))]),
    ) as Record<MatrixPlatform, SourceCell>;
    return { brand, cells };
  });
  const notOnApi = Object.fromEntries(
    MATRIX_PLATFORMS.map((p) => [p, rows.filter((r) => ["metricool", "error"].includes(r.cells[p].kind)).length]),
  ) as Record<MatrixPlatform, number>;
  const ytApi = brands.filter((b) => sources.some((s) => s.brand === b && s.network === "youtube-data-api"));
  const hasAnalytics = ytApi.filter((b) => sources.some((s) => s.brand === b && s.network === "youtube-analytics"));
  return {
    rows,
    notOnApi,
    notOnApiTotal: MATRIX_PLATFORMS.reduce((t, p) => t + notOnApi[p], 0),
    noAnalytics: ytApi.filter((b) => !hasAnalytics.includes(b)),
    hasAnalytics,
  };
}
