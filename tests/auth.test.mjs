import assert from "node:assert/strict";
import test from "node:test";

// Simulate browser storage & crypto for Node testing
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

globalThis.window = {
  crypto: {
    subtle: {
      digest: async (algo, data) => {
        // Simple hash buffer
        const buf = new Uint8Array(32);
        for (let i = 0; i < data.length; i++) {
          buf[i % 32] ^= data[i];
        }
        return buf.buffer;
      },
    },
  },
};

const {
  ensureDefaultAdmin,
  authenticateUser,
  registerNewUser,
  updateUserPassword,
  getAllUsers,
} = await import("../lib/auth/storage.ts");

test("Auth Storage - Default admin initialization", async () => {
  store.clear();
  await ensureDefaultAdmin();
  const users = getAllUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].username, "admin");
  assert.equal(users[0].role, "admin");
});

test("Auth Storage - Admin login success with 123456", async () => {
  const res = await authenticateUser({ username: "admin", password: "123456" });
  assert.ok(res, "Admin should authenticate");
  assert.equal(res.user.username, "admin");
  assert.ok(res.token, "Token should be generated");
});

test("Auth Storage - Admin login failure with wrong password", async () => {
  const res = await authenticateUser({ username: "admin", password: "wrongpassword" });
  assert.equal(res, null, "Wrong password should fail");
});

test("Auth Storage - Register new user", async () => {
  const reg = await registerNewUser({
    username: "somchai",
    name: "สมชาย ใจดี",
    password: "mypassword123",
  });
  assert.equal(reg.success, true);
  assert.equal(reg.user.username, "somchai");

  // Verify login with new user
  const loginRes = await authenticateUser({
    username: "somchai",
    password: "mypassword123",
  });
  assert.ok(loginRes);
  assert.equal(loginRes.user.name, "สมชาย ใจดี");
});

test("Auth Storage - Prevent duplicate username", async () => {
  const regDup = await registerNewUser({
    username: "somchai",
    name: "คนละสมชาย",
    password: "password456",
  });
  assert.equal(regDup.success, false);
  assert.match(regDup.error, /มีอยู่ในระบบแล้ว/);
});

test("Auth Storage - Update password", async () => {
  const users = getAllUsers();
  const admin = users.find((u) => u.username === "admin");
  assert.ok(admin);

  // Change password with wrong current
  const failRes = await updateUserPassword(admin.id, {
    currentPassword: "wrong",
    newPassword: "newsecretpassword",
  });
  assert.equal(failRes.success, false);

  // Change password with correct current
  const okRes = await updateUserPassword(admin.id, {
    currentPassword: "123456",
    newPassword: "newsecretpassword",
  });
  assert.equal(okRes.success, true);

  // Verify old password fails
  const oldLogin = await authenticateUser({ username: "admin", password: "123456" });
  assert.equal(oldLogin, null);

  // Verify new password succeeds
  const newLogin = await authenticateUser({ username: "admin", password: "newsecretpassword" });
  assert.ok(newLogin);
});
