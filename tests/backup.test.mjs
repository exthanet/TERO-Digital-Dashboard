import assert from "node:assert/strict";
import test from "node:test";
import { KEEP_BACKUPS, KEEP_SNAPSHOT_DAYS, cleanupOld } from "../lib/integrations/syncWriter.ts";
import { BACKUP_COLLECTIONS, toCsv } from "../scripts/backup-export.mjs";

const fakeDb = (names) => {
  const docs = Object.fromEntries(Object.entries(names).map(([c, ids]) => [c, ids.map((id) => ({ name: `projects/p/databases/(default)/documents/${c}/${id}` }))]));
  const deleted = [];
  return {
    deleted,
    listNames: async (c) => (docs[c] || []).map((d) => d.name.split("/").pop()),
    listRaw: async () => { throw new Error("cleanup must not download documents"); },
    delete: async (path) => deleted.push(path),
  };
};

test("Firestore keeps the last 3 sync backups and 60 days of snapshots; named backups stay; names only", async () => {
  assert.equal(KEEP_BACKUPS, 3);
  assert.equal(KEEP_SNAPSHOT_DAYS, 60);
  const db = fakeDb({
    syncRuns: [],
    snapshots: ["2026-07-01__00", "2026-09-01__00", "2026-10-05__00"],
    masterDataBackups: [
      "2026-10-03T01-13-14Z", "2026-10-03T01-13-14Z__000",
      "2026-10-04T00-40-57Z", "2026-10-05T00-57-22Z", "2026-10-06T02-19-45Z",
      "topic-fix-2026-10-05T07-15-37Z", "topic-fix-2026-10-05T07-15-37Z__000",
    ],
  });
  const removed = await cleanupOld(db, new Date("2026-10-06T03:00:00Z"));
  assert.deepEqual(removed, { syncRuns: 0, snapshots: 1, backups: 2 });
  assert.ok(db.deleted.includes("snapshots/2026-07-01__00"));
  assert.ok(!db.deleted.some((p) => p.includes("topic-fix")));
  assert.ok(!db.deleted.some((p) => p.includes("2026-10-04T00") || p.includes("2026-10-05T00") || p.includes("2026-10-06T02")));
});

test("3 backups or fewer: nothing removed; named backups never count", async () => {
  const db = fakeDb({ syncRuns: [], snapshots: ["2026-09-01__00"], masterDataBackups: ["2026-10-04T00-40-57Z", "2026-10-05T00-57-22Z", "2026-10-06T02-19-45Z", "topic-backfill-x"] });
  assert.deepEqual(await cleanupOld(db, new Date("2026-10-06T03:00:00Z")), { syncRuns: 0, snapshots: 0, backups: 0 });
});

test("backup CSV: Excel-friendly BOM, quoting, every column; no secrets collection", () => {
  const csv = toCsv([{ a: 1, b: 'say "hi", ok' }, { a: 2, c: "x\ny" }]);
  assert.ok(csv.startsWith("﻿a,b,c\r\n"));
  assert.ok(csv.includes('1,"say ""hi"", ok",'));
  assert.ok(csv.includes('2,,"x\ny"'));
  assert.ok(!BACKUP_COLLECTIONS.includes("syncSecrets"));
  assert.ok(!BACKUP_COLLECTIONS.includes("users"));
});
