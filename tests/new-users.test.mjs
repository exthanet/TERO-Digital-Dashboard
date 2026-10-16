import assert from "node:assert/strict";
import test from "node:test";
import { newUsersMessage, newUsersSince } from "../lib/integrations/newUsers.ts";

const users = [
  { uid: "a", email: "old@example.com", name: "Old", role: "admin" },
  { uid: "b", email: "b@example.com", name: "บี", role: "viewer", createdAt: "2026-10-16T07:05:00Z", mustChangePassword: false },
  { uid: "c", email: "c@example.com", name: "c@example.com", role: "content", createdAt: "2026-10-16T06:30:00Z", mustChangePassword: true },
  { uid: "d", email: "d@example.com", name: "D", role: "viewer", createdAt: "2026-10-15T01:00:00Z" },
];

test("only accounts created after the last check, oldest first", () => {
  const fresh = newUsersSince(users, "2026-10-16T00:00:00Z");
  assert.deepEqual(fresh.map((u) => u.uid), ["c", "b"]);
  assert.deepEqual(newUsersSince(users, "2026-10-16T07:05:00Z"), []);
});

test("one line per person: name, email, role, how they came in, Bangkok time", () => {
  const text = newUsersMessage(newUsersSince(users, "2026-10-16T00:00:00Z"));
  const lines = text.split("\n");
  assert.equal(lines[0], "👤 ผู้ใช้ใหม่ 2 คน ใน TERO Media Insights");
  assert.equal(lines[1], "• c@example.com · สิทธิ์ content · admin สร้างบัญชีให้ · 16 ต.ค. 13:30");
  assert.equal(lines[2], "• บี (b@example.com) · สิทธิ์ viewer · ล็อกอิน Microsoft ครั้งแรก · 16 ต.ค. 14:05");
  assert.match(lines[3], /จัดการผู้ใช้: https:\/\/digital-dashboard\.terodigital\.com$/);
});
