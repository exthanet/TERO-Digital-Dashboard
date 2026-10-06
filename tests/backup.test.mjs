import assert from "node:assert/strict";
import test from "node:test";
import { KEEP_WITH_GITHUB, cleanupOld } from "../lib/integrations/syncWriter.ts";
import { BACKUP_COLLECTIONS, toCsv } from "../scripts/backup-export.mjs";

const fakeDb = (names) => {
  const docs = Object.fromEntries(Object.entries(names).map(([c, ids]) => [c, ids.map((id) => ({ name: `projects/p/databases/(default)/documents/${c}/${id}` }))]));
  const deleted = [];
  return {
    deleted,
    listRaw: async (c) => docs[c] || [],
    delete: async (path) => deleted.push(path),
  };
};

test("with GitHub backups Firestore keeps the last 2 sync backups and 60 days of snapshots; named backups stay", async () => {
  const db = fakeDb({
    syncRuns: [],
    snapshots: ["2026-07-01__00", "2026-09-01__00", "2026-10-05__00"],
    masterDataBackups: [
      "2026-10-03T01-13-14Z", "2026-10-03T01-13-14Z__000",
      "2026-10-04T00-40-57Z", "2026-10-05T00-57-22Z", "2026-10-06T02-19-45Z",
      "topic-fix-2026-10-05T07-15-37Z", "topic-fix-2026-10-05T07-15-37Z__000",
    ],
  });
  const removed = await cleanupOld(db, new Date("2026-10-06T03:00:00Z"), KEEP_WITH_GITHUB);
  assert.deepEqual(removed, { syncRuns: 0, snapshots: 1, backups: 3 });
  assert.ok(db.deleted.includes("snapshots/2026-07-01__00"));
  assert.ok(!db.deleted.some((p) => p.includes("topic-fix")));
  assert.ok(!db.deleted.some((p) => p.includes("2026-10-05T00") || p.includes("2026-10-06T02")));
});

test("without GitHub backups the old limits stay (7 backups, a year of snapshots)", async () => {
  const db = fakeDb({ syncRuns: [], snapshots: ["2026-07-01__00"], masterDataBackups: ["2026-10-04T00-40-57Z", "2026-10-05T00-57-22Z", "topic-backfill-x"] });
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
