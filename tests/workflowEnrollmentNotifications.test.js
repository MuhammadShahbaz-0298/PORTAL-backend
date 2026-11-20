// Test enrollment candidate access and notification cleanup.
// The tests use authenticated HTTP requests against an in-memory database.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Notification = require("../models/Notification");
const { NOTIFICATION_TYPES } = require("../constants");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
let admin;
let adminClient;
let teacher;
let teacherClient;
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
  teacher = await createUser("teacher@example.test", "teacher");
  await createUser("student@example.test", "student");
  [adminClient, teacherClient, studentClient] = await Promise.all([
    login(environment, "admin@example.test"),
    login(environment, "teacher@example.test"),
    login(environment, "student@example.test"),
  ]);
});

test("teachers can enroll eligible students without seeing foreign batches", async () => {
  const otherTeacher = await createUser("other-teacher@example.test", "teacher");
  const targetBatch = await Batch.create({
    name: "Target batch",
    teacher: teacher._id,
    active: true,
  });
  const ownBatch = await Batch.create({
    name: "Other owned batch",
    teacher: teacher._id,
    active: true,
  });
  const foreignBatch = await Batch.create({
    name: "Foreign batch",
    teacher: otherTeacher._id,
    active: true,
  });
  const ownStudent = await createUser("own-student@example.test", "student");
  const targetStudent = await createUser("target-student@example.test", "student");
  const foreignStudent = await createUser("foreign-student@example.test", "student");
  const unassignedStudent = await createUser("unassigned@example.test", "student");

  await Enrollment.create([
    { student: ownStudent._id, batch: ownBatch._id },
    { student: targetStudent._id, batch: targetBatch._id },
    { student: foreignStudent._id, batch: foreignBatch._id },
  ]);

  const response = await teacherClient.get(`/api/batches/${targetBatch._id}/eligible-students`);
  assert.equal(response.status, 200);
  const eligibleIds = new Set(response.data.map((user) => user._id));
  assert.ok(eligibleIds.has(String(ownStudent._id)));
  assert.ok(eligibleIds.has(String(unassignedStudent._id)));
  assert.ok(!eligibleIds.has(String(targetStudent._id)));
  assert.ok(!eligibleIds.has(String(foreignStudent._id)));

  const enrolled = await teacherClient.post(`/api/batches/${targetBatch._id}/enroll`, {
    studentId: String(unassignedStudent._id),
  });
  assert.equal(enrolled.status, 201);
  assert.ok(
    await Enrollment.exists({
      student: unassignedStudent._id,
      batch: targetBatch._id,
    }),
  );

  const forbidden = await studentClient.get(`/api/batches/${targetBatch._id}/eligible-students`);
  assert.equal(forbidden.status, 403);
});

test("admins can enroll an eligible student and the batch lists refresh", async () => {
  const batch = await Batch.create({
    name: "Admin enrollment batch",
    teacher: teacher._id,
    active: true,
  });
  const student = await createUser("admin-enrolled@example.test", "student");

  const eligible = await adminClient.get(`/api/batches/${batch._id}/eligible-students`);
  assert.equal(eligible.status, 200);
  assert.ok(eligible.data.some((item) => item._id === String(student._id)));

  const enrolled = await adminClient.post(`/api/batches/${batch._id}/enroll`, {
    studentId: String(student._id),
  });
  assert.equal(enrolled.status, 201);
  assert.ok(await Enrollment.exists({ student: student._id, batch: batch._id }));

  const [students, stillEligible] = await Promise.all([
    adminClient.get(`/api/batches/${batch._id}/students`),
    adminClient.get(`/api/batches/${batch._id}/eligible-students`),
  ]);
  assert.equal(students.data.length, 1);
  assert.equal(students.data[0]._id, String(student._id));
  assert.equal(
    stillEligible.data.some((item) => item._id === String(student._id)),
    false,
  );
});

test("clear-all notifications deletes only the authenticated user's records", async () => {
  const notification = {
    type: NOTIFICATION_TYPES.ANNOUNCEMENT,
    message: "A test notice",
    channel: "inApp",
  };
  await Notification.create({ ...notification, recipient: admin._id });
  await Notification.create({ ...notification, recipient: teacher._id });

  const response = await adminClient.delete("/api/notifications");
  assert.equal(response.status, 200);
  assert.equal(response.data.deletedCount, 1);
  assert.equal(await Notification.countDocuments({ recipient: admin._id }), 0);
  assert.equal(await Notification.countDocuments({ recipient: teacher._id }), 1);
});
