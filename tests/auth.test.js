// Security tests for login, refresh rotation, reuse detection and revocation.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const jwt = require("jsonwebtoken");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
const Session = require("../models/Session");
const { ROLES } = require("../constants");
const { resetLoginRateLimits } = require("../utils/rateLimit");

const PASSWORD = "Password123!";
let environment;

before(async () => {
  environment = await startTestEnvironment();
});

after(async () => {
  await environment.stop();
});

beforeEach(async () => {
  await environment.cleanDatabase();
  resetLoginRateLimits();
});

async function createUser(overrides = {}) {
  return User.create({
    name: "Test User",
    email: "user@example.test",
    password: PASSWORD,
    role: ROLES.STUDENT,
    active: true,
    ...overrides,
  });
}

async function login(client, email) {
  return client.post("/api/auth/login", { email, password: PASSWORD });
}

test("login sets httpOnly cookies and never returns a token", async () => {
  await createUser({ email: "login@example.test" });
  const client = environment.createClient();
  const response = await login(client, "login@example.test");

  assert.equal(response.status, 200);
  assert.equal(response.data.user.email, "login@example.test");
  assert.equal(response.data.token, undefined);
  assert.ok(client.cookies.portal_access);
  assert.ok(client.cookies.portal_refresh);

  const me = await client.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.email, "login@example.test");
});

test("refresh rotates the token and replay revokes the whole family", async () => {
  await createUser({ email: "rotate@example.test" });
  const client = environment.createClient();
  await login(client, "rotate@example.test");
  const oldRefreshToken = client.cookies.portal_refresh;

  const refreshed = await client.post("/api/auth/refresh", {});
  assert.equal(refreshed.status, 200);
  assert.notEqual(client.cookies.portal_refresh, oldRefreshToken);

  const replayClient = environment.createClient();
  replayClient.cookies.portal_refresh = oldRefreshToken;
  const replay = await replayClient.post("/api/auth/refresh", {});
  assert.equal(replay.status, 401);

  // The whole family is revoked, including the newest refresh token.
  const afterReuse = await client.post("/api/auth/refresh", {});
  assert.equal(afterReuse.status, 401);
});

test("an expired access token is rejected", async () => {
  const user = await createUser({ email: "expired@example.test" });
  const client = environment.createClient();
  await login(client, "expired@example.test");
  const session = await Session.findOne({ user: user._id });

  client.cookies.portal_access = jwt.sign(
    { userId: String(user._id), sessionId: String(session._id) },
    process.env.JWT_SECRET,
    { expiresIn: "-1s", issuer: "portal-backend" },
  );

  const me = await client.get("/api/auth/me");
  assert.equal(me.status, 401);
});

test("the server enforces the idle timeout", async () => {
  const user = await createUser({ email: "idle@example.test" });
  const client = environment.createClient();
  await login(client, "idle@example.test");
  const session = await Session.findOne({ user: user._id });
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);

  await Session.updateOne({ _id: session._id }, { $set: { lastActiveAt: elevenMinutesAgo } });
  const me = await client.get("/api/auth/me");

  assert.equal(me.status, 401);
  const storedSession = await Session.findById(session._id);
  assert.ok(storedSession.revokedAt);
});

test("a disabled user is rejected immediately", async () => {
  const user = await createUser({ email: "disabled@example.test" });
  const client = environment.createClient();
  await login(client, "disabled@example.test");

  await User.updateOne({ _id: user._id }, { $set: { active: false } });
  const me = await client.get("/api/auth/me");

  assert.equal(me.status, 401);
  const openSessions = await Session.countDocuments({ user: user._id, revokedAt: null });
  assert.equal(openSessions, 0);
});

test("logout revokes the server session and clears cookies", async () => {
  await createUser({ email: "logout@example.test" });
  const client = environment.createClient();
  await login(client, "logout@example.test");
  const accessToken = client.cookies.portal_access;

  const logout = await client.post("/api/auth/logout", {});
  assert.equal(logout.status, 200);

  const oldClient = environment.createClient();
  oldClient.cookies.portal_access = accessToken;
  const me = await oldClient.get("/api/auth/me");
  assert.equal(me.status, 401);
});

test("login is locked after ten failures", async () => {
  await createUser({ email: "lockout@example.test" });
  const client = environment.createClient();

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
  const client = environment.createClient();
  const response = await client.post(
    "/api/auth/login",
    { email: "csrf@example.test", password: PASSWORD },
    { csrf: false },
  );

  assert.equal(response.status, 403);
});

test("changing the password revokes the other sessions", async () => {
  await createUser({ email: "password@example.test" });
  const firstClient = environment.createClient();
  const secondClient = environment.createClient();
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
