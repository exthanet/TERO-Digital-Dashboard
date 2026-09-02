/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  YOUTUBE_CHANNEL_ID?: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  YOUTUBE_REFRESH_TOKEN?: string;
  META_PAGE_ID?: string;
  META_IG_ACCOUNT_ID?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_ACCESS_TOKEN?: string;
  TIKTOK_ACCOUNT_ID?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_ACCESS_TOKEN?: string;
  TIKTOK_REFRESH_TOKEN?: string;
  METRICOOL_USER_ID?: string;
  METRICOOL_BLOG_ID?: string;
  METRICOOL_API_TOKEN?: string;
  DATABASE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/integrations/status" && request.method === "GET") {
      const groups = {
        youtube: ["YOUTUBE_CHANNEL_ID", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
        meta: ["META_PAGE_ID", "META_IG_ACCOUNT_ID", "META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"],
        tiktok: ["TIKTOK_ACCOUNT_ID", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN", "TIKTOK_REFRESH_TOKEN"],
        metricool: ["METRICOOL_USER_ID", "METRICOOL_BLOG_ID", "METRICOOL_API_TOKEN"],
        database: ["DATABASE_URL"],
      } as const;
      const status = Object.fromEntries(Object.entries(groups).map(([provider, keys]) => {
        const missing = keys.filter((key) => !env[key as keyof Env]);
        return [provider, { configured: missing.length === 0, missing }];
      }));
      return Response.json(status, { headers: { "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
