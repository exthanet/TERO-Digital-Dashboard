import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "data", "tiktok");
const apiBase = "https://open.tiktokapis.com/v2";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

async function getAccessToken() {
  if (process.env.TIKTOK_REFRESH_TOKEN && process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
    });
    const response = await fetch(`${apiBase}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      throw new Error(`TikTok token refresh failed: ${JSON.stringify(payload)}`);
    }
    return payload.access_token;
  }
  return required("TIKTOK_ACCESS_TOKEN");
}

async function fetchAllVideos(token) {
  const fields = [
    "id", "create_time", "cover_image_url", "share_url", "video_description",
    "title", "duration", "like_count", "comment_count", "share_count", "view_count",
  ].join(",");
  const videos = [];
  let cursor;
  let page = 0;

  do {
    const response = await fetch(`${apiBase}/video/list/?fields=${encodeURIComponent(fields)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error?.code && payload.error.code !== "ok") {
      throw new Error(`TikTok video list failed: ${JSON.stringify(payload)}`);
    }
    const data = payload.data || {};
    videos.push(...(data.videos || []));
    cursor = data.has_more ? data.cursor : undefined;
    page += 1;
    console.log(`Fetched page ${page}: ${data.videos?.length || 0} videos`);
  } while (cursor !== undefined);

  return videos;
}

const isoDate = (seconds) => seconds
  ? new Date(Number(seconds) * 1000).toISOString()
  : "";

const metricDate = new Date().toISOString().slice(0, 10);
const token = await getAccessToken();
const videos = await fetchAllVideos(token);
const rows = videos.map((video) => ({
  metric_date: metricDate,
  video_id: String(video.id || ""),
  publish_time_utc: isoDate(video.create_time),
  title: video.title || video.video_description || "",
  description: video.video_description || "",
  share_url: video.share_url || "",
  duration_seconds: video.duration ?? "",
  views: video.view_count ?? 0,
  likes: video.like_count ?? 0,
  comments: video.comment_count ?? 0,
  shares: video.share_count ?? 0,
}));

await fs.mkdir(outputDir, { recursive: true });
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "TikTok Daily Snapshot");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.map(({ metric_date, video_id, views, likes, comments, shares }) => ({ metric_date, video_id, views, likes, comments, shares }))), "Metrics");
XLSX.writeFile(workbook, path.join(outputDir, "tiktok-content-latest.xlsx"));
await fs.writeFile(path.join(outputDir, "tiktok-content-latest.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)));
await fs.writeFile(path.join(outputDir, "tiktok-content-latest.json"), JSON.stringify({
  fetched_at: new Date().toISOString(),
  metric_date: metricDate,
  count: rows.length,
  rows,
}, null, 2) + "\n");
console.log(`Saved ${rows.length} TikTok videos for ${metricDate}`);
