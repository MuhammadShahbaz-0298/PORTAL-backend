// Security tests for login and token rotation.
// These integration tests exercise server-side session and account controls.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureAuthTests } = require("./helpers/authTestHelpers");
const { createUser, login, getEnvironment } = configureAuthTests();
const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
test("login sets httpOnly cookies and never returns a token", async () => {
  await createUser({ email: "login@example.test" });
  const client = getEnvironment().createClient();
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
  const client = getEnvironment().createClient();
  await login(client, "rotate@example.test");
  const oldRefreshToken = client.cookies.portal_refresh;

  const refreshed = await client.post("/api/auth/refresh", {});
  assert.equal(refreshed.status, 200);
  assert.notEqual(client.cookies.portal_refresh, oldRefreshToken);

  const replayClient = getEnvironment().createClient();
  replayClient.cookies.portal_refresh = oldRefreshToken;
  const replay = await replayClient.post("/api/auth/refresh", {});
  assert.equal(replay.status, 401);

  // The whole family is revoked, including the newest refresh token.
  const afterReuse = await client.post("/api/auth/refresh", {});
  assert.equal(afterReuse.status, 401);
});

test("an expired access token is rejected", async () => {
  const user = await createUser({ email: "expired@example.test" });
  const client = getEnvironment().createClient();
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
  const client = getEnvironment().createClient();
  await login(client, "idle@example.test");
  const session = await Session.findOne({ user: user._id });
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);

  await Session.updateOne({ _id: session._id }, { $set: { lastActiveAt: elevenMinutesAgo } });
  const me = await client.get("/api/auth/me");

  assert.equal(me.status, 401);
  const storedSession = await Session.findById(session._id);
  assert.ok(storedSession.revokedAt);
});
