// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { loginAs, createData, PASSWORD } = configurePermissionTests();
const { ROLES } = require("../constants");
const Enrollment = require("../models/Enrollment");
test("teachers may register students only in their own batches", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const baseStudent = {
    name: "New Student",
    email: "new.student@example.test",
    password: PASSWORD,
    role: ROLES.STUDENT,
  };

  const deniedRole = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    role: ROLES.TEACHER,
  });
  assert.equal(deniedRole.status, 403);

  const deniedBatch = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    email: "other.student@example.test",
    batchId: String(data.batchB._id),
  });
  assert.equal(deniedBatch.status, 403);

  const allowed = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    email: "own.student@example.test",
    batchId: String(data.batchA._id),
  });
  assert.equal(allowed.status, 201);
});

test("enrolling in a new batch keeps the student's other enrollments", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const response = await teacherAClient.post(`/api/batches/${data.batchA._id}/enroll`, {
    studentId: String(data.studentB._id),
  });

  assert.equal(response.status, 201);
  const batchBEnrollment = await Enrollment.exists({
    student: data.studentB._id,
    batch: data.batchB._id,
  });
  assert.ok(batchBEnrollment);
});
