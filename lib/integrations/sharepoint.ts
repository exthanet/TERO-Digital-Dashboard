// Download a workbook from SharePoint / OneDrive with Microsoft Graph, as an
// app (client credentials), for the daily sync. The app is registered in the
// company's Microsoft Entra tenant and given read access to the site that
// holds the file (Sites.Selected), see docs/SYNC_SETUP_TH.md.
//
// Env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.

export interface GraphCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export function graphCredentials(env: Record<string, string | undefined> = process.env): GraphCredentials | null {
  const { AZURE_TENANT_ID: tenantId, AZURE_CLIENT_ID: clientId, AZURE_CLIENT_SECRET: clientSecret } = env;
  return tenantId && clientId && clientSecret ? { tenantId, clientId, clientSecret } : null;
}

export async function graphToken(c: GraphCredentials): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.clientId,
      client_secret: c.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Microsoft sign-in failed: ${(body.error_description || String(res.status)).split("\n")[0]}`);
  return body.access_token;
}

/** Graph's id for a sharing link: "u!" + base64url of the URL. */
export function shareId(url: string): string {
  return `u!${Buffer.from(url.trim()).toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-")}`;
}

/** The workbook file behind a SharePoint / OneDrive sharing link. */
export async function downloadSharedFile(url: string, token: string): Promise<Buffer> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId(url)}/driveItem/content`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const hint = res.status === 403 || res.status === 404 ? " (แอปยังไม่มีสิทธิ์อ่านไฟล์นี้ หรือลิงก์ผิด)" : "";
    throw new Error(`SharePoint ${res.status}: ${body.error?.message || res.statusText}${hint}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** When the shared file was last changed (to compare with a manual upload). */
export async function sharedFileModified(url: string, token: string): Promise<string> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId(url)}/driveItem?$select=lastModifiedDateTime`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return "";
  const body = (await res.json().catch(() => ({}))) as { lastModifiedDateTime?: string };
  return body.lastModifiedDateTime || "";
}

// Without the Graph app: a link shared as "Anyone with the link · Can view" can be
// downloaded as is. "?download=1" asks SharePoint for the file instead of the viewer.

/** The download address of a sharing link. */
export function anonymousDownloadUrl(url: string): string {
  const u = new URL(url.trim());
  u.searchParams.set("download", "1");
  return u.toString();
}

/** An .xlsx is a zip: it starts with "PK". A sign-in page (HTML) is not. */
export const isXlsx = (buf: Uint8Array) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;

/** The workbook behind an "Anyone with the link" sharing link, with no sign-in. */
export async function downloadAnonymousLink(url: string): Promise<Buffer> {
  // SharePoint answers 403 to a cold download: the link is opened first, step by
  // step, to get the guest cookie (FedAuth) it sets; then the download is asked again.
  const jar = new Map<string, string>();
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  let next = url.trim();
  for (let i = 0; i < 8 && next; i++) {
    const res = await fetch(next, { redirect: "manual", headers: { cookie: cookie() } });
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0];
      const eq = kv.indexOf("=");
      if (eq > 0) jar.set(kv.slice(0, eq), kv.slice(eq + 1));
    }
    const loc = res.headers.get("location");
    next = loc ? new URL(loc, next).toString() : "";
  }
  const res = await fetch(anonymousDownloadUrl(url), { redirect: "follow", headers: { cookie: cookie() } });
  if (!res.ok) throw new Error(`ลิงก์ ${res.status}: ดาวน์โหลดไม่ได้ (ลิงก์ต้องแชร์แบบ "Anyone with the link")`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isXlsx(buf)) throw new Error('ลิงก์ไม่ได้ส่งไฟล์ Excel กลับมา (อาจต้องล็อกอิน: แชร์ลิงก์แบบ "Anyone with the link" หรือให้ admin ตั้งค่า Microsoft Graph)');
  return buf;
}
