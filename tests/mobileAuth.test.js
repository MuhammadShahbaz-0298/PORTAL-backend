// Mobile client tests: x-client: mobile returns tokens in the body,
// refresh/logout accept a body refresh token, and web (no header) is unchanged.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
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
    role: "student",
    active: true,
    ...overrides,
  });
}

// A native client sends x-client: mobile on every request.
function mobilePost(client, path, body) {
  return client.post(path, body, { headers: { "x-client": "mobile" } });
}

test("mobile login returns accessToken and refreshToken and still sets cookies", async () => {
  await createUser({ email: "mobile@example.test" });
  const client = environment.createClient();
  const response = await mobilePost(client, "/api/auth/login", {
    email: "mobile@example.test",
    password: PASSWORD,
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.user.email, "mobile@example.test");
  assert.ok(response.data.accessToken, "mobile login should return accessToken");
  assert.ok(response.data.refreshToken, "mobile login should return refreshToken");
  assert.ok(client.cookies.portal_access, "mobile login should still set access cookie");
  assert.ok(client.cookies.portal_refresh, "mobile login should still set refresh cookie");
});

test("web login returns no tokens in the body", async () => {
  await createUser({ email: "web@example.test" });
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", {
    email: "web@example.test",
    password: PASSWORD,
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.accessToken, undefined);
  assert.equal(response.data.refreshToken, undefined);
  assert.ok(client.cookies.portal_access);
});

test("mobile refresh returns rotated accessToken and refreshToken", async () => {
  await createUser({ email: "mrefresh@example.test" });
  const client = environment.createClient();
  const loginResp = await mobilePost(client, "/api/auth/login", {
    email: "mrefresh@example.test",
    password: PASSWORD,
  });
  const bodyRefresh = loginResp.data.refreshToken;
  assert.ok(bodyRefresh, "mobile login response should carry a body refresh token");

  const oldCookie = client.cookies.portal_refresh;
  const refreshed = await mobilePost(client, "/api/auth/refresh", {
    refreshToken: bodyRefresh,
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.data.accessToken, "mobile refresh should return accessToken");
  assert.ok(refreshed.data.refreshToken, "mobile refresh should return refreshToken");
  assert.notEqual(client.cookies.portal_refresh, oldCookie, "refresh should rotate the cookie");
});

test("mobile refresh works with body token and no cookie", async () => {
  await createUser({ email: "mbody@example.test" });
  const client = environment.createClient();
  const loginResp = await mobilePost(client, "/api/auth/login", {
    email: "mbody@example.test",
    password: PASSWORD,
  });
  const bodyToken = loginResp.data.refreshToken;

  // Drop the cookie so only the body token is available.
  delete client.cookies.portal_refresh;

  const refreshed = await mobilePost(client, "/api/auth/refresh", {
    refreshToken: bodyToken,
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.data.accessToken);
  assert.ok(refreshed.data.refreshToken);
});

test("mobile logout accepts body token and revokes the session", async () => {
  await createUser({ email: "mlogout@example.test" });
  const client = environment.createClient();
  const loginResp = await mobilePost(client, "/api/auth/login", {
    email: "mlogout@example.test",
    password: PASSWORD,
  });
  const bodyToken = loginResp.data.refreshToken;

  const loggedOut = await mobilePost(client, "/api/auth/logout", {
    refreshToken: bodyToken,
  });
  assert.equal(loggedOut.status, 200);
  assert.equal(loggedOut.data.message, "Logged out.");

  const me = await client.get("/api/auth/me");
  assert.equal(me.status, 401);
});

test("mobile invalid body token returns 401 same as invalid cookie", async () => {
  await createUser({ email: "mbad@example.test" });
  const client = environment.createClient();
  delete client.cookies.portal_refresh;

  const refreshed = await mobilePost(client, "/api/auth/refresh", {
    refreshToken: "definitely-not-a-valid-token",
  });
  assert.equal(refreshed.status, 401);
});
