import assert from "node:assert/strict";
import test from "node:test";
import { can, cleanOverrides, effectivePerms, normalizeRole, overridesFor } from "../lib/auth/permissions.ts";

test("roles give their presets; admins always have everything", () => {
  assert.deepEqual(effectivePerms("viewer"), { advanced: false, deepDive: false, revenue: false, download: false, monthlyReport: false });
  assert.deepEqual(effectivePerms("content"), { advanced: true, deepDive: true, revenue: false, download: true, monthlyReport: false });
  assert.deepEqual(effectivePerms("finance"), { advanced: false, deepDive: false, revenue: true, download: true, monthlyReport: false });
  assert.equal(effectivePerms("executive").monthlyReport, true);
  assert.equal(effectivePerms("admin", { revenue: false }).revenue, true);
});

test("per-person switches on top of the role", () => {
  const u = { role: "viewer", perms: { revenue: true } };
  assert.equal(can(u, "revenue"), true);
  assert.equal(can(u, "download"), false);
  assert.equal(can({ role: "executive", perms: { download: false } }, "download"), false);
  assert.equal(can(null, "revenue"), false);
  // รายงานประจำเดือน is switched on per account in จัดการผู้ใช้.
  assert.equal(can({ role: "content", perms: { monthlyReport: true } }, "monthlyReport"), true);
  assert.equal(can({ role: "executive", perms: { monthlyReport: false } }, "monthlyReport"), false);
});

test("stored overrides: only differences from the role, only known booleans", () => {
  assert.deepEqual(overridesFor("content", { advanced: true, deepDive: true, revenue: true, download: true, monthlyReport: false }), { revenue: true });
  assert.equal(overridesFor("content", { advanced: true, deepDive: true, revenue: false, download: true, monthlyReport: false }), undefined);
  assert.deepEqual(cleanOverrides({ revenue: true, download: "yes", hack: true }), { revenue: true });
  assert.equal(normalizeRole("owner"), "viewer");
  assert.equal(normalizeRole("finance"), "finance");
});
