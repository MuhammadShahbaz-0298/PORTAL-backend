// Integration tests for Expo delivery behavior.
// The Expo sender is mocked so tests never call the external service.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { Expo } = require("expo-server-sdk");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const Announcement = require("../models/Announcement");
const DeviceToken = require("../models/DeviceToken");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const { createUser, login } = require("./helpers/workflowFixtures");
const { sendToUsers } = require("../services/pushService");
const { readPushSettings } = require("../config/env");

let environment;
let adminClient;
let student;

const TOKEN = "ExponentPushToken[push-test-token]";

test("push delivery is enabled by default and can be disabled", () => {
  assert.equal(readPushSettings({}).enabled, true);
  assert.equal(readPushSettings({ PUSH_ENABLED: "false" }).enabled, false);
});

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
  await createUser("push-admin@example.test", "admin");
  student = await createUser("push-student@example.test", "student");
  adminClient = await login(environment, "push-admin@example.test");
});

test("a DeviceNotRegistered response removes the affected token", async () => {
  await DeviceToken.create({ user: student._id, token: TOKEN, platform: "ios" });
  const originalSender = Expo.prototype.sendPushNotificationsAsync;
  Expo.prototype.sendPushNotificationsAsync = async () => [
    { status: "error", details: { error: "DeviceNotRegistered" } },
  ];

  try {
    await sendToUsers({
      userIds: [student._id],
      title: "Test",
      body: "Test message",
      data: {},
    });
  } finally {
    Expo.prototype.sendPushNotificationsAsync = originalSender;
  }

  assert.equal(await DeviceToken.countDocuments({ token: TOKEN }), 0);
});

test("announcement creation succeeds when the push sender fails", async () => {
  await DeviceToken.create({ user: student._id, token: TOKEN, platform: "android" });
  const originalSender = Expo.prototype.sendPushNotificationsAsync;
  const originalConsoleError = console.error;
  let loggedError = "";
  Expo.prototype.sendPushNotificationsAsync = async (messages) => {
    throw new Error(`Failed to send to ${messages[0].to}`);
  };
  console.error = (...values) => {
    loggedError += values
      .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
      .join(" ");
  };

  let response;
  try {
    response = await adminClient.post("/api/announcements", {
      title: "School update",
      body: "The school schedule has changed.",
      scope: "school",
    });
  } finally {
    Expo.prototype.sendPushNotificationsAsync = originalSender;
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 201);
  assert.equal(await Announcement.countDocuments({ title: "School update" }), 1);
  assert.ok(loggedError.includes("[redacted]"), loggedError);
  assert.ok(!loggedError.includes(TOKEN));
});
