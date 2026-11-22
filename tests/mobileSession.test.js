// Test mobile session-specific inactivity and absolute lifetime behavior.
// Sessions still use the same authenticated integration environment as web.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
const Session = require("../models/Session");

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
});

async function createUser(email) {
  return User.create({
    name: "Test User",
    email,
    password: PASSWORD,
    role: "student",
    active: true,
  });
}

function mobilePost(client, path, body) {
  return client.post(path, body, { headers: { "x-client": "mobile" } });
}

test("mobile sessions stay active after 10 idle minutes and use a 30-day cap", async () => {
  const user = await createUser("mobile-idle@example.test");
  const client = environment.createClient();
  const loginResponse = await mobilePost(client, "/api/auth/login", {
    email: "mobile-idle@example.test",
    password: PASSWORD,
  });
  const session = await Session.findOne({ user: user._id });
  assert.equal(session.client, "mobile");
  assert.equal(
    session.familyExpiresAt.getTime() - session.familyCreatedAt.getTime(),
    30 * 24 * 60 * 60 * 1000,
  );

  await Session.updateOne(
    { _id: session._id },
    { $set: { lastActiveAt: new Date(Date.now() - 11 * 60 * 1000) } },
  );
  const refreshed = await mobilePost(client, "/api/auth/refresh", {
    refreshToken: loginResponse.data.refreshToken,
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.data.refreshToken);
});

test("mobile refresh is rejected after the 30-day absolute session cap", async () => {
  const user = await createUser("mobile-cap@example.test");
  const client = environment.createClient();
  const loginResponse = await mobilePost(client, "/api/auth/login", {
    email: "mobile-cap@example.test",
    password: PASSWORD,
  });
  const session = await Session.findOne({ user: user._id });
  await Session.updateOne(
    { _id: session._id },
    { $set: { familyExpiresAt: new Date(Date.now() - 1000) } },
  );

  const refreshed = await mobilePost(client, "/api/auth/refresh", {
    refreshToken: loginResponse.data.refreshToken,
  });
  assert.equal(refreshed.status, 401);
});
