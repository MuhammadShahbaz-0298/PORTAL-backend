// Tests for AI draft response visibility.
// Tests exercise bounded parsing, retry behavior and response privacy.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureAiDraftTests } = require("./helpers/aiDraftTestHelpers");
const { createUser, createBatch, loginAs, createSubmission, buildDraft, ROLES } =
  configureAiDraftTests();
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
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
