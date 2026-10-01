export type RawRow = Record<string, unknown>;

export type RecordRow = {
  date: string;
  program: string;
  episodeId: string;
  topic: string;
  topicType: string;
  vdoType: string;
  platform: string;
  channel: string;
  province: string;
  contentId: string;
  url: string;
  durationMin: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  engagementRate: number;
  ratingTotal: number;
  ratingBkk: number;
  ratingUrban: number;
  ratingBkkUrban: number;
  ratingRural: number;
  audienceTotal: number;
  gmmRating: number;
  gmmAudience: number;
  bestOfMonth: string;
  uploadCount: number;
  revenue: number;
  /** Average watch time per view, seconds, from the API (0 = not reported). */
  avgWatchSec: number;
  /** Video length from the same API, seconds (0 = not reported). */
  videoLengthSec: number;
  /** Instagram Reels: % of plays skipped at the start; null = not reported. */
  skipRate: number | null;
};

export type CompareRow = {
  date: string;
  topic: string;
  program: string;
  one: number;
  gmm: number;
  oneAudience: number;
  gmmAudience: number;
  youtube: number;
  facebook: number;
  tiktok: number;
  engagement: number;
  page: string;
  /** Aired on TV (a TV row was matched into this group). */
  hasTv: boolean;
  tvAudience: number;
  online: number;
  /** TV audience + online views. */
  total: number;
};

export type CompareSortKey = keyof CompareRow;
export type CompareFilter = "all" | "tv" | "online";

export type IntegrationStatus = { configured: boolean; missing: string[] };

export type IntegrationMap = Record<
  "youtube" | "meta" | "tiktok" | "metricool" | "database",
  IntegrationStatus
>;

/** Date menu: rolling ranges end yesterday; years, months and quarters carry their year. */
export type DatePreset =
  | "LAST_7_DAYS"
  | "LAST_28_DAYS"
  | "LAST_90_DAYS"
  | "LAST_365_DAYS"
  | "ALL"
  | `YEAR_${number}`
  | `MONTH_${number}-${string}`
  | `QUARTER_${number}_${1 | 2 | 3 | 4}`
  | "CUSTOM";

/** What the KPI % compares with. */
export type ComparePreset = "PREVIOUS" | "YEAR_AGO" | "CUSTOM" | "NONE";
