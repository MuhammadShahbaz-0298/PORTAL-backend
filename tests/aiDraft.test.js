// Tests for AI draft parsing, retries and the regeneration rules.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const { parseDraftResponse } = require("../services/aiDraftParser");
const aiDraftService = require("../services/aiDraftService");
const submissionView = require("../utils/submissionView");

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

async function withAiKey(callback) {
  const previousKey = process.env.AI_API_KEY;
  const previousEnabled = process.env.AI_ENABLED;
  process.env.AI_API_KEY = "test-key";
  process.env.AI_ENABLED = "true";

  try {
    return await callback();
  } finally {
    if (previousKey === undefined) {
      delete process.env.AI_API_KEY;
    } else {
      process.env.AI_API_KEY = previousKey;
    }

    if (previousEnabled === undefined) {
      delete process.env.AI_ENABLED;
    } else {
      process.env.AI_ENABLED = previousEnabled;
    }
  }
}

async function createUser(email, role) {
  return User.create({ name: email, email, password: PASSWORD, role, active: true });
}

async function createBatch(name, teacherId) {
  return Batch.create({ name, teacher: teacherId, active: true });
}

async function loginAs(email) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", { email, password: PASSWORD });
  assert.equal(response.status, 200);
  return client;
}

async function createSubmission({ assignment, student, batch, aiDraft }) {
  return Submission.create({
    assignment: assignment._id,
    student: student._id,
    batch: batch._id,
    filePath: "stored.zip",
    fileName: "work.zip",
    fileSize: 100,
    status: "submitted",
    aiDraft,
  });
}

function buildDraft(overrides = {}) {
  return {
    status: "ready",
    feedback: "A useful draft.",
    suggestedMarks: 80,
    strengths: ["Clear"],
    improvements: ["Add tests"],
    model: "test-model",
    attempts: 1,
    generations: 1,
    requestedAt: new Date(),
    snapshot: {
      files: [{ path: "src/app.js", text: "console.log('hi');" }],
      truncated: false,
      totalChars: 19,
    },
    ...overrides,
  };
}

test("JSON inside markdown fences is parsed and cleaned", () => {
  const reply = [
    "Here is my answer:",
    "```json",
    JSON.stringify({
      feedback: "Good work. Email me at teacher@example.com for help.",
      suggestedMarks: 142,
      strengths: ["Clear names"],
      improvements: ["Add tests", "   "],
    }),
    "```",
    "Thanks!",
  ].join("\n");

  const parsed = parseDraftResponse(reply);

  assert.equal(parsed.suggestedMarks, 100);
  assert.ok(parsed.feedback.includes("[email removed]"));
  assert.ok(!parsed.feedback.includes("teacher@example.com"));
  assert.deepEqual(parsed.strengths, ["Clear names"]);
  assert.deepEqual(parsed.improvements, ["Add tests"]);
});

test("response shaping hides aiDraft from students and snapshot from staff", () => {
  const document = {
    toObject: () => ({
      _id: "abc",
      aiDraft: { feedback: "draft", snapshot: { files: [{ path: "a.js", text: "secret" }] } },
    }),
  };

  const studentView = submissionView.toVisibleSubmission(document, { role: "student" });
  assert.equal(studentView.aiDraft, undefined);

  const teacherView = submissionView.toVisibleSubmission(document, { role: "teacher" });
  assert.equal(teacherView.aiDraft.feedback, "draft");
  assert.equal(teacherView.aiDraft.snapshot, undefined);
});

test("429 responses are retried four times and then the draft fails", async () => {
  await withAiKey(async () => {
    const teacher = await createUser("teacher@example.test", ROLES.TEACHER);
    const student = await createUser("student@example.test", ROLES.STUDENT);
    const batch = await createBatch("Batch A", teacher._id);
    await Enrollment.create({ student: student._id, batch: batch._id });
    const assignment = await Assignment.create({
      batch: batch._id,
      title: "Week 1",
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacher._id,
    });
    const submission = await createSubmission({
      assignment,
      student,
      batch,
      aiDraft: buildDraft({ status: "pending", attempts: 0, generations: 0 }),
    });

    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/chat/completions")) {
        calls += 1;
        return new Response(JSON.stringify({ error: "rate limit" }), {
          status: 429,
          headers: { "retry-after": "0", "content-type": "application/json" },
        });
      }

      return realFetch(url);
    };

    try {
      await aiDraftService.generateDraft(submission._id, { sleep: async () => {} });
    } finally {
      globalThis.fetch = realFetch;
    }

    const saved = await Submission.findById(submission._id);
    assert.equal(calls, 4);
    assert.equal(saved.aiDraft.status, "failed");
    assert.equal(saved.aiDraft.attempts, 4);
    assert.match(saved.aiDraft.error, /rate limit/i);
  });
});

test("regenerate needs permission and respects the lifetime limit", async () => {
  await withAiKey(async () => {
    const teacherA = await createUser("teacher.a@example.test", ROLES.TEACHER);
    await createUser("teacher.b@example.test", ROLES.TEACHER);
    const student = await createUser("student@example.test", ROLES.STUDENT);
    const batchA = await createBatch("Batch A", teacherA._id);
    await Enrollment.create({ student: student._id, batch: batchA._id });
    const assignment = await Assignment.create({
      batch: batchA._id,
      title: "Week 1",
      dueDate: new Date(Date.now() + 86400000),
      createdBy: teacherA._id,
    });
    const submission = await createSubmission({
      assignment,
      student,
      batch: batchA,
      aiDraft: buildDraft({ generations: 8 }),
    });

    const studentClient = await loginAs("student@example.test");
    const teacherBClient = await loginAs("teacher.b@example.test");
    const teacherAClient = await loginAs("teacher.a@example.test");

    assert.equal(
      (await studentClient.post(`/api/submissions/${submission._id}/ai-draft`, {})).status,
      403,
    );
    assert.equal(
      (await teacherBClient.post(`/api/submissions/${submission._id}/ai-draft`, {})).status,
      403,
    );

    const limitResponse = await teacherAClient.post(
      `/api/submissions/${submission._id}/ai-draft`,
      {},
    );
    assert.equal(limitResponse.status, 409);
    assert.match(limitResponse.data.error, /8 times/);
  });
});

test("students never see aiDraft, and teachers never see the snapshot", async () => {
  delete process.env.AI_API_KEY;

  const teacher = await createUser("teacher@example.test", ROLES.TEACHER);
  const student = await createUser("student@example.test", ROLES.STUDENT);
  const batch = await createBatch("Batch A", teacher._id);
  await Enrollment.create({ student: student._id, batch: batch._id });
  const assignment = await Assignment.create({
    batch: batch._id,
    title: "Week 1",
    dueDate: new Date(Date.now() + 86400000),
    createdBy: teacher._id,
  });
  const submission = await createSubmission({
    assignment,
    student,
    batch,
    aiDraft: buildDraft(),
  });

  const studentClient = await loginAs("student@example.test");
  const studentList = await studentClient.get(`/api/submissions?assignmentId=${assignment._id}`);
  assert.equal(studentList.status, 200);
  assert.equal(studentList.data.length, 1);
  assert.equal(studentList.data[0].aiDraft, undefined);

  const teacherClient = await loginAs("teacher@example.test");
  const teacherList = await teacherClient.get(`/api/submissions?assignmentId=${assignment._id}`);
  assert.equal(teacherList.status, 200);
  assert.equal(teacherList.data.length, 1);
  assert.equal(teacherList.data[0].aiDraft.status, "ready");
  assert.equal(teacherList.data[0].aiDraft.snapshot, undefined);

  const graded = await teacherClient.patch(`/api/submissions/${submission._id}/grade`, {
    grade: "80",
    feedback: "A useful draft.",
  });
  assert.equal(graded.status, 200);
  assert.equal(graded.data.aiDraft.status, "used");
  assert.equal(graded.data.aiDraft.snapshot, undefined);
});
