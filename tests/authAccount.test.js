// Security tests for account and request controls.
// These integration tests exercise server-side session and account controls.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureAuthTests } = require("./helpers/authTestHelpers");
const { createUser, login, PASSWORD, getEnvironment } = configureAuthTests();
const User = require("../models/User");
const Session = require("../models/Session");
test("a disabled user is rejected immediately", async () => {
  const user = await createUser({ email: "disabled@example.test" });
  const client = getEnvironment().createClient();
  await login(client, "disabled@example.test");

  await User.updateOne({ _id: user._id }, { $set: { active: false } });
  const me = await client.get("/api/auth/me");

  assert.equal(me.status, 401);
  const openSessions = await Session.countDocuments({ user: user._id, revokedAt: null });
  assert.equal(openSessions, 0);
});

test("logout revokes the server session and clears cookies", async () => {
  await createUser({ email: "logout@example.test" });
  const client = getEnvironment().createClient();
  await login(client, "logout@example.test");
  const accessToken = client.cookies.portal_access;

  const logout = await client.post("/api/auth/logout", {});
  assert.equal(logout.status, 200);

  const oldClient = getEnvironment().createClient();
  oldClient.cookies.portal_access = accessToken;
  const me = await oldClient.get("/api/auth/me");
  assert.equal(me.status, 401);
});

test("login is locked after ten failures", async () => {
  await createUser({ email: "lockout@example.test" });
  const client = getEnvironment().createClient();

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await client.post("/api/auth/login", {
      email: "lockout@example.test",
      password: "WrongPassword123!",
    });
    assert.equal(response.status, 401);
  }

  const locked = await client.post("/api/auth/login", {
    email: "lockout@example.test",
    password: PASSWORD,
  });
  assert.equal(locked.status, 429);
});

test("unsafe requests without the CSRF header are rejected", async () => {
  await createUser({ email: "csrf@example.test" });
  const client = getEnvironment().createClient();
  const response = await client.post(
    "/api/auth/login",
    { email: "csrf@example.test", password: PASSWORD },
    { csrf: false },
  );

  assert.equal(response.status, 403);
});

test("changing the password revokes the other sessions", async () => {
  await createUser({ email: "password@example.test" });
  const firstClient = getEnvironment().createClient();
  const secondClient = getEnvironment().createClient();
  await login(firstClient, "password@example.test");
  await login(secondClient, "password@example.test");

  const changed = await firstClient.post("/api/auth/change-password", {
    currentPassword: PASSWORD,
    newPassword: "NewPassword123!",
  });
  assert.equal(changed.status, 200);

  const secondMe = await secondClient.get("/api/auth/me");
  assert.equal(secondMe.status, 401);

  const firstMe = await firstClient.get("/api/auth/me");
  assert.equal(firstMe.status, 200);
});
