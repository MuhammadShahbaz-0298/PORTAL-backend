// Test report-card downloads for students enrolled in multiple active batches.
// Requests run against the in-memory integration database.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
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
  await ensureCoreRoles();
  const teacher = await createUser("teacher@example.test", "teacher");
  student = await createUser("student@example.test", "student");
  const batches = await Batch.create([
    { name: "Grade 1", teacher: teacher._id, active: true },
    { name: "Science", teacher: teacher._id, active: true },
  ]);
  await Enrollment.create(batches.map((batch) => ({ student: student._id, batch: batch._id })));
  studentClient = await login(environment, "student@example.test");
});

test("a student can download one report card for all enrolled classes", async () => {
  const response = await studentClient.download(`/api/users/${student._id}/report-card`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/pdf/);
  assert.match(response.body.subarray(0, 5).toString(), /^%PDF-/);
});

test("a student cannot download another student's report card", async () => {
  const otherStudent = await createUser("other-student@example.test", "student");
  const response = await studentClient.download(`/api/users/${otherStudent._id}/report-card`);

  assert.equal(response.status, 403);
});
