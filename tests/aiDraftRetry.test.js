// Tests for AI draft retries.
// Tests exercise bounded parsing, retry behavior and response privacy.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureAiDraftTests } = require("./helpers/aiDraftTestHelpers");
const { withAiKey, createUser, createBatch, createSubmission, buildDraft, ROLES } =
  configureAiDraftTests();
const Submission = require("../models/Submission");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const aiDraftService = require("../services/aiDraftService");
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
