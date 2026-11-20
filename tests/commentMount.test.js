// Tests for comments on submissions.
// Verifies creation and listing through the mounted HTTP routes.
const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");

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
  await ensureCoreRoles();
});

async function createUser(email, role) {
  return User.create({ name: email, email, password: PASSWORD, role, active: true });
}
async function loginAs(email) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", { email, password: PASSWORD });
  assert.equal(response.status, 200);
  return client;
}

test("comments can be posted and listed through the real mount path", async () => {
  await createUser("admin@example.test", ROLES.ADMIN);
  const teacher = await createUser("teacher@example.test", ROLES.TEACHER);
  const student = await createUser("student@example.test", ROLES.STUDENT);
  const batch = await Batch.create({ name: "Batch A", teacher: teacher._id, active: true });
  await Enrollment.create({ student: student._id, batch: batch._id });
  const assignment = await Assignment.create({
    batch: batch._id,
    title: "Week 1",
    dueDate: new Date(Date.now() + 86400000),
    createdBy: teacher._id,
  });
  const submission = await Submission.create({
    assignment: assignment._id,
    student: student._id,
    batch: batch._id,
    filePath: "fake.zip",
    fileName: "fake.zip",
    originalName: "fake.zip",
  });

  const teacherClient = await loginAs("teacher@example.test");
  const post = await teacherClient.post(`/api/submissions/${submission._id}/comments`, {
    text: "Nice work",
  });
  assert.equal(post.status, 201, `expected 201, got ${post.status}: ${JSON.stringify(post.data)}`);

  const list = await teacherClient.get(`/api/submissions/${submission._id}/comments`);
  assert.equal(list.status, 200);
  const items = Array.isArray(list.data) ? list.data : list.data.items || [];
  assert.equal(items.length, 1);
  assert.equal(items[0].text, "Nice work");
});
