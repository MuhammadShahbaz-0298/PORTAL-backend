// Integration tests for authenticated push-device routes.
// The in-memory database verifies token ownership and request validation.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const DeviceToken = require("../models/DeviceToken");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
let owner;
let other;
let ownerClient;
let otherClient;

const TOKEN = "ExponentPushToken[device-token-123]";

before(async () => {
  environment = await startTestEnvironment();
});

after(async () => {
  await environment.stop();
});

beforeEach(async () => {
  await environment.cleanDatabase();
  resetLoginRateLimits();
  await ensureCoreRoles();
  owner = await createUser("owner@example.test", "student");
  other = await createUser("other@example.test", "student");
  [ownerClient, otherClient] = await Promise.all([
    login(environment, "owner@example.test"),
    login(environment, "other@example.test"),
  ]);
});

test("a user can register and unregister their own token", async () => {
  const registered = await ownerClient.post("/api/devices", {
    token: TOKEN,
    platform: "ios",
  });

  assert.equal(registered.status, 201);
  const device = await DeviceToken.findOne({ token: TOKEN });
  assert.equal(String(device.user), String(owner._id));
  assert.equal(device.platform, "ios");
  assert.ok(device.lastSeenAt instanceof Date);

  const removed = await ownerClient.delete(`/api/devices/${encodeURIComponent(TOKEN)}`);
  assert.equal(removed.status, 200);
  assert.equal(await DeviceToken.countDocuments({ token: TOKEN }), 0);
});

test("registering an existing token assigns it to the current user", async () => {
  await ownerClient.post("/api/devices", { token: TOKEN, platform: "ios" });

  const response = await otherClient.post("/api/devices", {
    token: TOKEN,
    platform: "android",
  });
  const device = await DeviceToken.findOne({ token: TOKEN });

  assert.equal(response.status, 201);
  assert.equal(await DeviceToken.countDocuments({ token: TOKEN }), 1);
  assert.equal(String(device.user), String(other._id));
  assert.equal(device.platform, "android");
});

test("a user cannot delete another user's token", async () => {
  await ownerClient.post("/api/devices", { token: TOKEN, platform: "android" });

  const response = await otherClient.delete(`/api/devices/${encodeURIComponent(TOKEN)}`);

  assert.equal(response.status, 404);
  assert.equal(await DeviceToken.countDocuments({ token: TOKEN, user: owner._id }), 1);
});

test("an invalid Expo token format is rejected", async () => {
  const response = await ownerClient.post("/api/devices", {
    token: "not-an-expo-token",
    platform: "ios",
  });

  assert.equal(response.status, 400);
  assert.equal(await DeviceToken.countDocuments(), 0);
});

test("an unsupported device platform is rejected", async () => {
  const response = await ownerClient.post("/api/devices", {
    token: TOKEN,
    platform: "desktop",
  });

  assert.equal(response.status, 400);
  assert.equal(await DeviceToken.countDocuments(), 0);
});

test("device registration and removal require authentication", async () => {
  const client = environment.createClient();

  const registration = await client.post("/api/devices", { token: TOKEN, platform: "ios" });
  const removal = await client.delete(`/api/devices/${encodeURIComponent(TOKEN)}`);

  assert.equal(registration.status, 401);
  assert.equal(removal.status, 401);
});
