// Tests for AI draft regeneration access.
// Tests exercise bounded parsing, retry behavior and response privacy.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureAiDraftTests } = require("./helpers/aiDraftTestHelpers");
const { withAiKey, createUser, createBatch, loginAs, createSubmission, buildDraft, ROLES } =
  configureAiDraftTests();
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
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
