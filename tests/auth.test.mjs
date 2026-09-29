import assert from "node:assert/strict";
import test from "node:test";

// Accounts live in Firebase Auth + Firestore; the end-to-end flow (invite,
// login, roles, rules) is exercised against the emulators by
// scripts/test-auth-emulator.mjs. These cover the pure helpers.
const {
  authErrorMessage,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordProblem,
  randomPassword,
} = await import("../lib/auth/validation.ts");

test("emails are trimmed and lower-cased", () => {
  assert.equal(normalizeEmail("  Somchai@TeroDigital.COM "), "somchai@terodigital.com");
});

test("any domain is a valid email, malformed input is not", () => {
  assert.equal(isValidEmail("exec@gmail.com"), true);
  assert.equal(isValidEmail("head@terodigital.com"), true);
  assert.equal(isValidEmail("no-at-sign"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a b@c.com"), false);
});

test("password length rule", () => {
  assert.match(passwordProblem("short"), /อย่างน้อย/);
  assert.equal(passwordProblem("x".repeat(MIN_PASSWORD_LENGTH)), null);
});

test("invite passwords are long and not repeated", () => {
  const a = randomPassword();
  const b = randomPassword();
  assert.equal(a.length, 48);
  assert.notEqual(a, b);
});

test("Firebase error codes map to Thai messages with a fallback", () => {
  assert.equal(authErrorMessage({ code: "auth/invalid-credential" }, "x"), "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  assert.equal(authErrorMessage({ code: "auth/email-already-in-use" }, "x"), "อีเมลนี้มีบัญชีอยู่แล้ว");
  assert.equal(authErrorMessage({ code: "something/else" }, "fallback"), "fallback");
  assert.equal(authErrorMessage(null, "fallback"), "fallback");
});
