export const PROGRAMS = [
  "ถกไม่เถียง",
  "เงินทองของจริง",
  "Kidsfun",
  "Hitzradio",
];

export const PLATFORM_COLORS: Record<string, string> = {
  YouTube: "#ef4444",
  Facebook: "#2563eb",
  TikTok: "#111827",
  Instagram: "#d946ef",
  TV: "#10b981",
};

export const TYPE_COLORS: Record<string, string> = {
  "YouTube Live": "#ef4444",
  "TV Episode": "#2563eb",
  "YouTube Full Episode": "#2563eb",
  "YouTube Highlight": "#0ea5e9",
  "YouTube Shorts": "#7c3aed",
  "Facebook/IG Reels": "#f59e0b",
  TikTok: "#0f766e",
  Other: "#94a3b8",
};

export const TOPIC_COLORS = [
  "#2563eb",
  "#ef4444",
  "#10b981",
  "#7c3aed",
  "#d946ef",
  "#f59e0b",
  "#64748b",
  "#14b8a6",
  "#fb7185",
  "#f97316",
];

export const INTEGRATIONS = [
  {
    id: "youtube" as const,
    name: "YouTube",
    detail: "Data API + Analytics API",
    fields: ["Channel ID", "Client ID", "Client Secret", "Refresh Token"],
    keys: [
      "YOUTUBE_CHANNEL_ID",
      "YOUTUBE_CLIENT_ID",
      "YOUTUBE_CLIENT_SECRET",
      "YOUTUBE_REFRESH_TOKEN",
    ],
    color: "#ef4444",
  },
  {
    id: "meta" as const,
    name: "Facebook / Instagram",
    detail: "Meta Graph API",
    fields: [
      "Facebook Page ID",
      "Instagram Account ID",
      "App ID",
      "App Secret",
      "Long-lived Access Token",
    ],
    keys: [
      "META_PAGE_ID",
      "META_IG_ACCOUNT_ID",
      "META_APP_ID",
      "META_APP_SECRET",
      "META_ACCESS_TOKEN",
    ],
    color: "#2563eb",
  },
  {
    id: "tiktok" as const,
    name: "TikTok",
    detail: "Official API หรือ Metricool fallback",
    fields: [
      "Business Account ID",
      "Client Key",
      "Client Secret",
      "Access Token",
      "Refresh Token",
    ],
    keys: [
      "TIKTOK_ACCOUNT_ID",
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
      "TIKTOK_ACCESS_TOKEN",
      "TIKTOK_REFRESH_TOKEN",
    ],
    color: "#111827",
  },
  {
    id: "metricool" as const,
    name: "Metricool",
    detail: "Social performance fallback",
    fields: ["User ID", "Blog ID", "API Token"],
    keys: ["METRICOOL_USER_ID", "METRICOOL_BLOG_ID", "METRICOOL_API_TOKEN"],
    color: "#10b981",
  },
  {
    id: "database" as const,
    name: "Database",
    detail: "เก็บ Master Data และ Sync History",
    fields: ["Database URL"],
    keys: ["DATABASE_URL"],
    color: "#7c3aed",
  },
];
