import assert from "node:assert/strict";
import test from "node:test";
import { decodeFields } from "../lib/integrations/firestoreRest.ts";
import { writeSnapshot } from "../lib/integrations/syncWriter.ts";

/** Minimal in-memory stand-in for the Firestore class (list / get / set / delete). */
function fakeDb() {
  const docs = new Map();
  const reads = [];
  return {
    docs,
    reads,
    async listRaw(col) {
      reads.push(`list ${col}`);
      return [...docs].filter(([p]) => p.startsWith(`${col}/`)).map(([p, fields]) => ({ name: `x/${p}`, fields }));
    },
    async listNames(col) {
      return [...docs.keys()].filter((p) => p.startsWith(`${col}/`)).map((p) => p.slice(col.length + 1));
    },
    async get(path) {
      reads.push(path);
      return docs.has(path) ? { name: `x/${path}`, fields: docs.get(path) } : null;
    },
    async set(path, fields) { docs.set(path, fields); return { name: path, fields }; },
    async delete(path) { docs.delete(path); },
  };
}

const rowsOf = (db, prefix) =>
  [...db.docs].filter(([p]) => p.startsWith(prefix)).flatMap(([, f]) => decodeFields(f).rows);

test("a second run on the same day merges into that day's snapshot", async () => {
  const db = fakeDb();
  await writeSnapshot(db, "2026-09-29", "run0", [{ k: "old", v: 1 }]);
  await writeSnapshot(db, "2026-09-30", "run1", [{ k: "a", v: 10 }, { k: "b", v: 20 }]);
  await writeSnapshot(db, "2026-09-30", "run2", [{ k: "b", v: 25 }, { k: "c", v: 5 }]);

  const today = rowsOf(db, "snapshots/2026-09-30__").sort((x, y) => x.k.localeCompare(y.k));
  assert.deepEqual(today, [{ k: "a", v: 10 }, { k: "b", v: 25 }, { k: "c", v: 5 }]);
  assert.deepEqual(rowsOf(db, "snapshots/2026-09-29__"), [{ k: "old", v: 1 }]);
  // Only that day's parts are downloaded, never the whole collection.
  assert.ok(!db.reads.some((r) => r.startsWith("list ") || r.includes("2026-09-29")));
});
