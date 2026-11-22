// Test quiz notifications, enrolled-student access, and scored submissions.
// Students can see their quiz questions but never the correct answer indices.

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
let adminClient;
let admin;
let teacher;
let student;
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
  admin = await createUser("admin@example.test", "admin");
  teacher = await createUser("teacher@example.test", "teacher");
  student = await createUser("student@example.test", "student");
  batch = await Batch.create({
    name: "Grade 1",
    teacher: teacher._id,
    active: true,
  });
  await Enrollment.create({ student: student._id, batch: batch._id });
  adminClient = await login(environment, "admin@example.test");
});

test("creating a quiz notifies enrolled students with a working quiz link", async () => {
  const response = await adminClient.post("/api/quizzes", {
    title: "HTML basics",
    batchId: String(batch._id),
    timeLimitMinutes: 20,
    questions: [
      {
        text: "Which tag creates a link?",
        options: ["<div>", "<a>"],
        correctIndex: 1,
      },
    ],
  });

  assert.equal(response.status, 201);
  const notification = await Notification.findOne({
    recipient: student._id,
    type: NOTIFICATION_TYPES.NEW_QUIZ,
  });
  assert.ok(notification);
  assert.equal(notification.message, "New quiz: HTML basics");
  assert.equal(notification.link, `/quizzes/${response.data._id}`);
  assert.equal(await Notification.countDocuments({ recipient: admin._id }), 0);
});

test("students can take an enrolled quiz but cannot read another batch's quiz", async () => {
  const created = await adminClient.post("/api/quizzes", {
    title: "HTML basics",
    batchId: String(batch._id),
    timeLimitMinutes: 20,
    questions: [
      {
        text: "Which tag creates a link?",
        options: ["<div>", "<a>"],
        correctIndex: 1,
      },
      {
        text: "Which tag creates a paragraph?",
        options: ["<p>", "<img>"],
        correctIndex: 0,
      },
    ],
  });

  const studentClient = await login(environment, "student@example.test");

  const quiz = await studentClient.get(`/api/quizzes/${created.data._id}`);
  assert.equal(quiz.status, 200);
  assert.equal("correctIndex" in quiz.data.questions[0], false);

  const started = await studentClient.post(`/api/quizzes/${created.data._id}/attempt/start`);
  assert.equal(started.status, 201);

  const submitted = await studentClient.post(`/api/quizzes/${created.data._id}/attempt`, {
    answers: [1, 1],
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.score, 1);
  assert.equal(submitted.data.total, 2);

  const duplicate = await studentClient.post(`/api/quizzes/${created.data._id}/attempt`, {
    answers: [1, 0],
  });
  assert.equal(duplicate.status, 409);

  const otherBatch = await Batch.create({
    name: "Grade 2",
    teacher: teacher._id,
    active: true,
  });
  const otherQuiz = await adminClient.post("/api/quizzes", {
    title: "Private to another batch",
    batchId: String(otherBatch._id),
    timeLimitMinutes: 10,
    questions: [{ text: "Question", options: ["A", "B"], correctIndex: 0 }],
  });
  assert.equal((await studentClient.get(`/api/quizzes/${otherQuiz.data._id}`)).status, 403);
  assert.equal(
    (await studentClient.post(`/api/quizzes/${otherQuiz.data._id}/attempt/start`)).status,
    403,
  );
});

test("quiz lists can be filtered by batch", async () => {
  const otherBatch = await Batch.create({
    name: "Grade 2",
    teacher: teacher._id,
    active: true,
  });
  for (const [title, batchId] of [
    ["Grade 1 quiz", String(batch._id)],
    ["Grade 2 quiz", String(otherBatch._id)],
  ]) {
    const response = await adminClient.post("/api/quizzes", {
      title,
      batchId,
      timeLimitMinutes: 10,
      questions: [{ text: "Question", options: ["A", "B"], correctIndex: 0 }],
    });
    assert.equal(response.status, 201);
  }

  const response = await adminClient.get(`/api/quizzes?batchId=${batch._id}`);
  assert.equal(response.status, 200);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].title, "Grade 1 quiz");
});
