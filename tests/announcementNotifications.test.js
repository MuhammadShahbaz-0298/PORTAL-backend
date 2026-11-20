// Verify announcement creation succeeds and notifies only other recipients.
// The author must not receive a notification for their own announcement.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const Notification = require("../models/Notification");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
let admin;
let adminClient;
let student;
let studentClient;

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
  admin = await createUser("admin@example.test", "admin");
  student = await createUser("student@example.test", "student");
  [adminClient, studentClient] = await Promise.all([
    login(environment, "admin@example.test"),
    login(environment, "student@example.test"),
  ]);
});

test("school-wide announcement creation succeeds without notifying its author", async () => {
  const response = await adminClient.post("/api/announcements", {
    title: "Schedule update",
    body: "The school schedule has been updated.",
    scope: "school",
  });

  assert.equal(response.status, 201);
  assert.equal(response.data.title, "Schedule update");
  assert.equal(await Notification.countDocuments({ recipient: admin._id }), 0);
  assert.equal(await Notification.countDocuments({ recipient: student._id }), 1);
  const inbox = await studentClient.get("/api/notifications");
  assert.equal(inbox.status, 200);
  assert.equal(inbox.data[0].type, "announcement");
  assert.equal(inbox.data[0].message, "Schedule update");

  const updated = await adminClient.patch(`/api/announcements/${response.data._id}`, {
    body: "The school schedule has been updated.",
  });
  assert.equal(updated.status, 200);
});
