// Shared fixtures for AI draft integration tests.
// Each run uses test credentials and restores provider settings afterward.

const assert = require("node:assert/strict");
const { before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./integration");
const User = require("../../models/User");
const Batch = require("../../models/Batch");
const Submission = require("../../models/Submission");
const { ROLES } = require("../../constants");
const { resetLoginRateLimits } = require("../../utils/rateLimit");

const PASSWORD = "Password123!";

function configureAiDraftTests() {
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

  return {
    withAiKey,
    createUser,
    createBatch,
    loginAs,
    createSubmission,
    buildDraft,
    ROLES,
  };
}

module.exports = { configureAiDraftTests };
