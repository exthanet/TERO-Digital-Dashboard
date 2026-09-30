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
