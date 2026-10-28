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

test("a backup cut off before its manifest is dropped and does not count as one of the 3 kept", async () => {
  const db = fakeDb({
    syncRuns: [],
    snapshots: [],
    masterDataBackups: [
      "2026-10-25T00-21-23Z", "2026-10-25T00-21-23Z__chunk_000",
      "2026-10-26T00-24-30Z", "2026-10-27T01-29-43Z",
      "2026-10-28T01-25-12Z__chunk_000", "2026-10-28T01-25-12Z__chunk_001",
      "2026-10-29T00-30-00Z",
    ],
  });
  const removed = await cleanupOld(db, new Date("2026-10-29T01:00:00Z"));
  assert.equal(removed.backups, 4);
  assert.ok(db.deleted.includes("masterDataBackups/2026-10-28T01-25-12Z__chunk_001"));
  assert.ok(db.deleted.includes("masterDataBackups/2026-10-25T00-21-23Z"));
  assert.ok(!db.deleted.some((p) => /10-2[679]T/.test(p)));
});

test("writes run a few at a time; after a failure nothing new starts and the error comes back once all have stopped", async () => {
  const { eachLimited } = await import("../lib/integrations/syncWriter.ts");
  let running = 0;
  let most = 0;
  const done = [];
  await eachLimited([1, 2, 3, 4, 5, 6, 7, 8, 9], async (x) => {
    running++;
    most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    done.push(x);
  }, 4);
  assert.equal(most, 4);
  assert.equal(done.length, 9);
  const started = [];
  await assert.rejects(
    eachLimited([1, 2, 3, 4, 5, 6, 7, 8], async (x) => {
      started.push(x);
      await new Promise((r) => setTimeout(r, x === 2 ? 1 : 20));
      if (x === 2) throw new Error("write chunk_002: precondition");
      running++;
      running--;
    }, 3),
    /chunk_002/,
  );
  assert.deepEqual(started, [1, 2, 3]);
  assert.equal(running, 0);
});
