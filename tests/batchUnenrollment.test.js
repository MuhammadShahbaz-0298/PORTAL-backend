// Verify batch removal preserves history and immediately removes access.
// Ownership and enrollment permissions are checked through authenticated routes.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
let adminClient;
let teacher;
let teacherClient;
let studentClient;
let learnerClient;

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
  await createUser("admin@example.test", "admin");
  teacher = await createUser("teacher@example.test", "teacher");
  await createUser("student@example.test", "student");
  [adminClient, teacherClient, studentClient] = await Promise.all([
    login(environment, "admin@example.test"),
    login(environment, "teacher@example.test"),
    login(environment, "student@example.test"),
  ]);
});

test("removing a student preserves the record and restores eligibility", async () => {
  const student = await createUser("learner@example.test", "student");
  const batch = await Batch.create({
    name: "Primary",
    teacher: teacher._id,
    active: true,
  });
  const otherBatch = await Batch.create({
    name: "Second",
    teacher: teacher._id,
    active: true,
  });
  await Enrollment.create([
    { student: student._id, batch: batch._id },
    { student: student._id, batch: otherBatch._id },
  ]);
  learnerClient = await login(environment, "learner@example.test");
  const quiz = await adminClient.post("/api/quizzes", {
    title: "Access after removal",
    batchId: String(batch._id),
    timeLimitMinutes: 10,
    questions: [{ text: "Question?", options: ["A", "B"], correctIndex: 0 }],
  });
  assert.equal(quiz.status, 201);

  const response = await teacherClient.delete(`/api/batches/${batch._id}/students/${student._id}`);
  assert.equal(response.status, 200);

  const enrollment = await Enrollment.findOne({
    student: student._id,
    batch: batch._id,
  });
  assert.equal(enrollment.active, false);
  assert.ok(enrollment.removedAt);

  const [students, eligible, otherEnrollment] = await Promise.all([
    adminClient.get(`/api/batches/${batch._id}/students`),
    adminClient.get(`/api/batches/${batch._id}/eligible-students`),
    Enrollment.findOne({ student: student._id, batch: otherBatch._id }),
  ]);
  assert.equal(students.data.length, 0);
  assert.ok(eligible.data.some((item) => item._id === String(student._id)));
  assert.equal(otherEnrollment.active, true);
  assert.equal((await learnerClient.get(`/api/quizzes/${quiz.data._id}`)).status, 403);

  const reEnrolled = await teacherClient.post(`/api/batches/${batch._id}/enroll`, {
    studentId: String(student._id),
  });
  assert.equal(reEnrolled.status, 201);
  const reactivated = await Enrollment.findOne({
    student: student._id,
    batch: batch._id,
  });
  assert.equal(reactivated.active, true);
  assert.equal(reactivated.removedAt, null);
});

test("only an authorized owner or administrator can remove a student", async () => {
  await createUser("other-teacher@example.test", "teacher");
  const student = await createUser("learner@example.test", "student");
  const batch = await Batch.create({
    name: "Owned batch",
    teacher: teacher._id,
    active: true,
  });
  await Enrollment.create({ student: student._id, batch: batch._id });

  const otherTeacherClient = await login(environment, "other-teacher@example.test");
  const forbidden = await otherTeacherClient.delete(
    `/api/batches/${batch._id}/students/${student._id}`,
  );
  const studentForbidden = await studentClient.delete(
    `/api/batches/${batch._id}/students/${student._id}`,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(studentForbidden.status, 403);

  const removed = await adminClient.delete(`/api/batches/${batch._id}/students/${student._id}`);
  assert.equal(removed.status, 200);
});
