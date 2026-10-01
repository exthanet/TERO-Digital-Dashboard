// The sync's side of the compact dashboard copy (see lib/dashboard/cacheFormat.ts):
// after masterData is written and verified, stamp masterData/meta with a new
// version and write dashboardCache/* for that version. Same format as the
// browser writes after an admin import.
import { gzipSync } from "node:zlib";
import { partId, slimRows, splitBytes } from "../dashboard/cacheFormat.ts";
import { decodeFields, encodeFields, type Firestore } from "./firestoreRest.ts";

type Row = Record<string, unknown>;

export async function writeDashboardCache(db: Firestore, rows: Row[], version: string, updatedAt: string): Promise<number> {
  const previous = await db.get("dashboardCache/meta");
  const oldParts = previous ? Number(decodeFields(previous.fields || {}).parts || 0) : 0;
  await db.set("masterData/meta", encodeFields({ version, updatedAt, rowCount: rows.length }));
  const parts = splitBytes(gzipSync(JSON.stringify(slimRows(rows as never)), { level: 9 }));
  for (let i = 0; i < parts.length; i++) {
    await db.set(`dashboardCache/${partId(i)}`, {
      ...encodeFields({ version, part: i }),
      data: { bytesValue: Buffer.from(parts[i]).toString("base64") },
    });
  }
  await db.set("dashboardCache/meta", encodeFields({ version, parts: parts.length, rowCount: rows.length, createdAt: new Date().toISOString() }));
  for (let i = parts.length; i < oldParts; i++) await db.delete(`dashboardCache/${partId(i)}`);
  return parts.length;
}

/** After a restore: drop the copy's claim so the dashboard reads masterData until the next sync. */
export async function invalidateDashboardCache(db: Firestore): Promise<void> {
  await db.delete("dashboardCache/meta");
}
