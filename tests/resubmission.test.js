// Tests for r es ub mi ss io n.t es t.
// Verifies observable behavior without depending on test order.
// Tests for the assignment resubmission policy and graded/rejected rules.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { buildZipForm } = require("./helpers/zipBuilder");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
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

async function createUser(email, role) {
  return User.create({ name: email, email, password: PASSWORD, role, active: true });
}

async function loginAs(email) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", { email, password: PASSWORD });
  assert.equal(response.status, 200);
  return client;
}

async function createData() {
  const teacher = await createUser("teacher@example.test", ROLES.TEACHER);
  const student = await createUser("student@example.test", ROLES.STUDENT);
  const batch = await Batch.create({ name: "Batch A", teacher: teacher._id, active: true });
  await Enrollment.create({ student: student._id, batch: batch._id });
  const assignment = await Assignment.create({
    batch: batch._id,
    title: "Week 1",
    dueDate: new Date(Date.now() + 86400000),
    resubmissionPolicy: "disabled",
    createdBy: teacher._id,
  });
  const submission = await Submission.create({
    assignment: assignment._id,
    student: student._id,
    batch: batch._id,
    filePath: "old.zip",
    fileName: "old.zip",
    fileSize: 100,
    status: "submitted",
  });

  return { assignment, student, submission };
}

test("resubmission rules match the assignment policy and submission status", async () => {
  delete process.env.AI_API_KEY;
  const data = await createData();
  const client = await loginAs("student@example.test");
  const requestPath = `/api/submissions/${data.submission._id}/file`;

  const disabledResponse = await client.upload(
    requestPath,
    await buildZipForm({ "index.js": "console.log('one');" }),
    "PATCH",
  );
  assert.equal(disabledResponse.status, 409);
  assert.match(disabledResponse.data.error, /disabled/i);

  data.assignment.resubmissionPolicy = "allowed";
  await data.assignment.save();
  data.submission.status = "graded";
  await data.submission.save();

  const gradedResponse = await client.upload(
    requestPath,
    await buildZipForm({ "index.js": "console.log('two');" }),
    "PATCH",
  );
  assert.equal(gradedResponse.status, 409);
  assert.match(gradedResponse.data.error, /graded/i);

  data.assignment.resubmissionPolicy = "disabled";
  await data.assignment.save();
  data.submission.status = "rejected";
  await data.submission.save();

  const rejectedResponse = await client.upload(
    requestPath,
    await buildZipForm({ "index.js": "console.log('three');" }),
    "PATCH",
  );
  assert.equal(rejectedResponse.status, 200);
  assert.equal(rejectedResponse.data.status, "submitted");
});
