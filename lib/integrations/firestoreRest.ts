// Firestore over REST with a service account, for scripts (no firebase-admin
// dependency). Service accounts are checked by IAM, not firestore.rules, so
// the `dashboard-sync` account needs the "Cloud Datastore User" role.
import { createSign } from "node:crypto";

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Service account token failed: ${body.error_description || res.status}`);
  return body.access_token;
}

type FsValue = Record<string, unknown>;

/** Firestore REST value → plain JS. */
export function decodeValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FsValue[] }).values || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields || {});
  return undefined;
}

export function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

export async function listDocuments(
  projectId: string,
  collection: string,
  token: string,
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const out: { id: string; data: Record<string, unknown> }[] = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string; error?: { message: string } };
    if (!res.ok) throw new Error(`Firestore list ${collection} failed: ${body.error?.message || res.status}`);
    for (const d of body.documents || []) out.push({ id: d.name.split("/").pop() || "", data: decodeFields(d.fields || {}) });
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return out;
}

/** Same reading rules as loadMasterDataWithMetaFromFirebase in lib/firebase.ts. */
export async function loadMasterRows(projectId: string, token: string) {
  const docs = await listDocuments(projectId, "masterData", token);
  const rows: Record<string, unknown>[] = [];
  let updatedAt = "";
  for (const d of docs) {
    if (typeof d.data.updatedAt === "string" && d.data.updatedAt > updatedAt) updatedAt = d.data.updatedAt;
    if (Array.isArray(d.data.rows)) rows.push(...(d.data.rows as Record<string, unknown>[]));
    else if (d.id.startsWith("chunk_") || !d.id.startsWith("meta")) rows.push(d.data);
  }
  return { rows, docs: docs.length, updatedAt };
}
