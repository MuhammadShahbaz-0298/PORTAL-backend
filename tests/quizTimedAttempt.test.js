// Verify timed quiz sessions persist answers and submit at the server deadline.
// The deadline is set in the database during the test to avoid waiting.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const { createUser, login } = require("./helpers/workflowFixtures");

let environment;
let adminClient;
let studentClient;
let batch;

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
  const teacher = await createUser("teacher@example.test", "teacher");
  const student = await createUser("student@example.test", "student");
  batch = await Batch.create({
    name: "Grade 1",
    teacher: teacher._id,
    active: true,
  });
  await Enrollment.create({ student: student._id, batch: batch._id });
  [adminClient, studentClient] = await Promise.all([
    login(environment, "admin@example.test"),
    login(environment, "student@example.test"),
  ]);
});

async function createTimedQuiz(timeLimitMinutes = 15) {
  return adminClient.post("/api/quizzes", {
    title: "Timed quiz",
    batchId: String(batch._id),
    timeLimitMinutes,
    questions: [
      { text: "First?", options: ["A", "B"], correctIndex: 1 },
      { text: "Second?", options: ["C", "D"], correctIndex: 0 },
    ],
  });
}

test("students resume a timed attempt and expiry submits saved answers", async () => {
  const quizResponse = await createTimedQuiz();
  assert.equal(quizResponse.status, 201);
  const quizId = quizResponse.data._id;

  const started = await studentClient.post(`/api/quizzes/${quizId}/attempt/start`);
  assert.equal(started.status, 201);
  assert.equal(started.data.status, "inProgress");
  assert.ok(started.data.expiresAt);

  const saved = await studentClient.patch(`/api/quizzes/${quizId}/attempt`, {
    answers: [1, -1],
  });
  assert.equal(saved.data.answers[0], 1);
  assert.equal(saved.data.status, "inProgress");

  const resumed = await studentClient.post(`/api/quizzes/${quizId}/attempt/start`);
  assert.equal(resumed.data._id, started.data._id);
  assert.equal(resumed.data.expiresAt, started.data.expiresAt);

  await QuizAttempt.updateOne(
    { _id: started.data._id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  const expiredSave = await studentClient.patch(`/api/quizzes/${quizId}/attempt`, {
    answers: [0, 0],
  });
  assert.equal(expiredSave.data.status, "submitted");
  assert.deepEqual(expiredSave.data.answers, [1, -1]);
  assert.equal(expiredSave.data.score, 1);
  assert.equal(expiredSave.data.total, 2);

  const attempts = await adminClient.get(`/api/quizzes/${quizId}/attempts`);
  assert.equal(attempts.data.length, 1);
  assert.equal(await Quiz.countDocuments({ _id: quizId }), 1);
});

test("quiz time limits must be whole minutes within the supported range", async () => {
  const missing = await adminClient.post("/api/quizzes", {
    title: "Missing time",
    batchId: String(batch._id),
    questions: [{ text: "Question?", options: ["A", "B"], correctIndex: 0 }],
  });
  const fractional = await createTimedQuiz(1.5);
  const tooLong = await createTimedQuiz(1441);

  assert.equal(missing.status, 400);
  assert.equal(fractional.status, 400);
  assert.equal(tooLong.status, 400);
});

test("the third focus violation submits the attempt after two warnings", async () => {
  const quizResponse = await createTimedQuiz();
  const quizId = quizResponse.data._id;
  const started = await studentClient.post(`/api/quizzes/${quizId}/attempt/start`);
  await studentClient.patch(`/api/quizzes/${quizId}/attempt`, {
    answers: [1, -1],
  });

  const firstWarning = await studentClient.post(`/api/quizzes/${quizId}/attempt/violation`);
  const secondWarning = await studentClient.post(`/api/quizzes/${quizId}/attempt/violation`);
  const terminated = await studentClient.post(`/api/quizzes/${quizId}/attempt/violation`);

  assert.equal(firstWarning.data.focusViolationCount, 1);
  assert.equal(firstWarning.data.status, "inProgress");
  assert.equal(secondWarning.data.focusViolationCount, 2);
  assert.equal(secondWarning.data.status, "inProgress");
  assert.equal(terminated.data.focusViolationCount, 3);
  assert.equal(terminated.data.status, "submitted");
  assert.deepEqual(terminated.data.answers, [1, -1]);
  assert.equal(terminated.data.score, 1);
  assert.equal(await QuizAttempt.countDocuments({ _id: started.data._id }), 1);
});
