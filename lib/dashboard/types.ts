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
};

export type CompareSortKey = keyof CompareRow;

export type IntegrationStatus = { configured: boolean; missing: string[] };

export type IntegrationMap = Record<
  "youtube" | "meta" | "tiktok" | "metricool" | "database",
  IntegrationStatus
>;

export type DatePreset =
  | "ALL"
  | "TODAY"
  | "LAST_7_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "THIS_YEAR"
  | "LAST_YEAR"
  | "QUARTER_1"
  | "QUARTER_2"
  | "QUARTER_3"
  | "QUARTER_4"
  | "CUSTOM";
