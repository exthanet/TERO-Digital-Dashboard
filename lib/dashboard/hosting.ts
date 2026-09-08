// These public build flags contain no credentials. Sites keeps its existing defaults.
export const isStaticHost = process.env.NEXT_PUBLIC_STATIC_HOST === "true";
export function dashboardAsset(filename: string): string {
  return `${process.env.NEXT_PUBLIC_ASSET_BASE || "/"}${filename}`;
}
