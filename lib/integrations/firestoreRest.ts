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

/** Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to run everything against the local emulator. */
const emulatorHost = () => process.env.FIRESTORE_EMULATOR_HOST || "";

export function documentsBase(projectId: string): string {
  const host = emulatorHost();
  return host
    ? `http://${host}/v1/projects/${projectId}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  // The emulator accepts "owner" as an admin token that skips rules.
  if (emulatorHost()) return "owner";
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
    const url = new URL(`${documentsBase(projectId)}/${collection}`);
    url.searchParams.set("pageSize", "10"); // masterData documents are ~0.5 MB each
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

// ---------- raw documents and writes ----------

export interface RawDoc {
  name: string;
  fields: Record<string, FsValue>;
  updateTime?: string;
}

/** Plain JS → Firestore REST value (integers stay integers). */
export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodeValue(v)]));
}

/** Temporary server errors (5xx, dropped connection) are retried with a short backoff. */
async function fetchRetry(url: string | URL, init?: RequestInit, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || i >= tries) return res;
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
}

export class Firestore {
  readonly base: string;
  private token: string;

  constructor(projectId: string, token: string) {
    this.base = documentsBase(projectId);
    this.token = token;
  }

  private headers(json = false) {
    return { authorization: `Bearer ${this.token}`, ...(json ? { "content-type": "application/json" } : {}) };
  }

  /** All documents of a collection with their raw fields and update times. */
  async listRaw(collection: string): Promise<RawDoc[]> {
    const out: RawDoc[] = [];
    let pageToken = "";
    do {
      const url = new URL(`${this.base}/${collection}`);
      url.searchParams.set("pageSize", "10"); // masterData documents are ~0.5 MB each
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetchRetry(url, { headers: this.headers() });
      const body = (await res.json()) as { documents?: RawDoc[]; nextPageToken?: string; error?: { message: string } };
      if (!res.ok) throw new Error(`list ${collection}: ${body.error?.message || res.status}`);
      out.push(...(body.documents || []));
      pageToken = body.nextPageToken || "";
    } while (pageToken);
    return out;
  }

  /**
   * Document ids of a collection without their contents (field mask): one read
   * per document but no download, for cleanups that only look at names.
   */
  async listNames(collection: string): Promise<string[]> {
    return (await this.listStamps(collection)).map((d) => docId(d.name));
  }

  /** Like listNames, with each document's update time (fields left empty). */
  async listStamps(collection: string): Promise<RawDoc[]> {
    const out: RawDoc[] = [];
    let pageToken = "";
    do {
      const url = new URL(`${this.base}/${collection}`);
      url.searchParams.set("pageSize", "300");
      url.searchParams.set("mask.fieldPaths", "__name__");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetchRetry(url, { headers: this.headers() });
      const body = (await res.json()) as { documents?: { name: string; updateTime?: string }[]; nextPageToken?: string; error?: { message: string } };
      if (!res.ok) throw new Error(`list ${collection}: ${body.error?.message || res.status}`);
      for (const d of body.documents || []) out.push({ name: d.name, fields: {}, updateTime: d.updateTime });
      pageToken = body.nextPageToken || "";
    } while (pageToken);
    return out;
  }

  async get(path: string): Promise<RawDoc | null> {
    const res = await fetchRetry(`${this.base}/${path}`, { headers: this.headers() });
    if (res.status === 404) return null;
    const body = (await res.json()) as RawDoc & { error?: { message: string } };
    if (!res.ok) throw new Error(`get ${path}: ${body.error?.message || res.status}`);
    return body;
  }

  /**
   * Replace a document. `updateTime` = only if nobody changed it since then;
   * `mustNotExist` = only create.
   */
  async set(path: string, fields: Record<string, FsValue>, pre: { updateTime?: string; mustNotExist?: boolean } = {}): Promise<RawDoc> {
    // commit (not PATCH): preconditions travel in the body, which both
    // production and the emulator honour (the emulator ignores them in a PATCH URL).
    const name = `${this.base.split("/v1/")[1]}/${path}`;
    const currentDocument = pre.updateTime ? { updateTime: pre.updateTime } : pre.mustNotExist ? { exists: false } : undefined;
    const res = await fetchRetry(`${this.base}:commit`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ writes: [{ update: { name, fields }, ...(currentDocument ? { currentDocument } : {}) }] }),
    });
    const body = (await res.json()) as { writeResults?: { updateTime?: string }[]; error?: { message: string } };
    if (!res.ok) throw new Error(`write ${path}: ${body.error?.message || res.status}`);
    return { name, fields, updateTime: body.writeResults?.[0]?.updateTime };
  }

  async delete(path: string): Promise<void> {
    const res = await fetchRetry(`${this.base}/${path}`, { method: "DELETE", headers: this.headers() });
    if (!res.ok && res.status !== 404) throw new Error(`delete ${path}: ${res.status}`);
  }
}

/** Short document id from a full resource name. */
export const docId = (name: string) => name.split("/").pop() || "";
