// Tests for e ve nt ow ne rs hi p.t es t.
// Verifies observable behavior without depending on test order.
const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
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

test("admin can manage school-wide events and teacher is restricted to own batches", async () => {
  await createUser("admin@example.test", ROLES.ADMIN);
  const teacherA = await createUser("teachera@example.test", ROLES.TEACHER);
  const teacherB = await createUser("teacherb@example.test", ROLES.TEACHER);
  const student = await createUser("student@example.test", ROLES.STUDENT);

  const batchA = await Batch.create({ name: "Batch A", teacher: teacherA._id, active: true });
  const batchB = await Batch.create({ name: "Batch B", teacher: teacherB._id, active: true });
  await Enrollment.create({ student: student._id, batch: batchA._id });

  const adminClient = await loginAs("admin@example.test");
  const teacherClient = await loginAs("teachera@example.test");
  const studentClient = await loginAs("student@example.test");

  const schoolWide = await adminClient.post("/api/events", {
    title: "School fair",
    description: "For everyone",
    date: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(schoolWide.status, 201);

  const batchEvent = await teacherClient.post("/api/events", {
    title: "Batch A trip",
    date: new Date(Date.now() + 2 * 86400000).toISOString(),
    batchId: String(batchA._id),
  });
  assert.equal(batchEvent.status, 201);

  const otherBatch = await teacherClient.post("/api/events", {
    title: "Nope",
    date: new Date(Date.now() + 86400000).toISOString(),
    batchId: String(batchB._id),
  });
  assert.equal(otherBatch.status, 403);

  const teacherSchoolWide = await teacherClient.post("/api/events", {
    title: "Nope",
    date: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(teacherSchoolWide.status, 400);

  const studentList = await studentClient.get("/api/events");
  assert.equal(studentList.status, 200);
  const items = Array.isArray(studentList.data) ? studentList.data : studentList.data.items || [];
  const titles = items.map((e) => e.title);
  assert.ok(titles.includes("School fair"));
  assert.ok(titles.includes("Batch A trip"));
});
