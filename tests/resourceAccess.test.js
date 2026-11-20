// Integration tests for assignment resource access and uploads.
// Fixtures use real multipart requests and an isolated in-memory database.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureResourceTests } = require("./helpers/resourceAttachmentTestHelpers");
const { createUser, createWorld, loginAs, pdfForm, PDF_BYTES } = configureResourceTests();
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const { ROLES } = require("../constants");
test("wrong teacher rejected from uploading resource", async () => {
  const owner = await createUser("owner@example.test", ROLES.TEACHER);
  await createUser("teacher1@example.test", ROLES.TEACHER);

  const batch = await Batch.create({ name: "Batch A", teacher: owner._id, active: true });
  const assignment = await Assignment.create({
    batch: batch._id,
    title: "Week 1",
    dueDate: new Date(Date.now() + 86400000),
    createdBy: owner._id,
  });

  const client = await loginAs("teacher1@example.test");
  const resp = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());

  assert.equal(resp.status, 403, "A teacher who does not own the assignment must be rejected.");
});

test("student outside the batch rejected from downloading", async () => {
  const { assignment } = await createWorld();
  const otherStudent = await createUser("otherStudent@example.test", ROLES.STUDENT);

  const otherBatch = await Batch.create({
    name: "Batch B",
    teacher: assignment.createdBy,
    active: true,
  });
  await Enrollment.create({ student: otherStudent._id, batch: otherBatch._id });

  const teacherClient = await loginAs("teacher@example.test");
  const uploadResp = await teacherClient.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(),
  );
  assert.equal(uploadResp.status, 201);

  const studentClient = await loginAs("otherStudent@example.test");
  const downloadResp = await studentClient.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );

  assert.equal(
    downloadResp.status,
    404,
    "A student in another batch must not learn the resource exists.",
  );
});

test("owning teacher uploads a real file and downloads the same bytes", async () => {
  const { assignment } = await createWorld();
  const client = await loginAs("teacher@example.test");

  const uploadResp = await client.upload(`/api/assignments/${assignment._id}/resources`, pdfForm());
  assert.equal(uploadResp.status, 201);

  const downloadResp = await client.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );
  assert.equal(downloadResp.status, 200);
  assert.deepEqual(downloadResp.body, PDF_BYTES);
  assert.match(downloadResp.headers.get("content-disposition") || "", /^attachment;/);
  assert.equal(downloadResp.headers.get("x-content-type-options"), "nosniff");
});

test("an enrolled student can download the uploaded file", async () => {
  const { assignment } = await createWorld();

  const teacherClient = await loginAs("teacher@example.test");
  const uploadResp = await teacherClient.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(),
  );
  assert.equal(uploadResp.status, 201);

  const studentClient = await loginAs("student@example.test");
  const downloadResp = await studentClient.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );

  assert.equal(downloadResp.status, 200);
  assert.deepEqual(downloadResp.body, PDF_BYTES);
});

test("an unenrolled student gets 404", async () => {
  const { assignment } = await createWorld();
  await createUser("lonely@example.test", ROLES.STUDENT);

  const teacherClient = await loginAs("teacher@example.test");
  const uploadResp = await teacherClient.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(),
  );
  assert.equal(uploadResp.status, 201);

  const studentClient = await loginAs("lonely@example.test");
  const downloadResp = await studentClient.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );

  assert.equal(downloadResp.status, 404);
});

test("a student from another batch gets 404", async () => {
  const { assignment } = await createWorld();
  const outsider = await createUser("outsider@example.test", ROLES.STUDENT);
  const otherBatch = await Batch.create({
    name: "Batch B",
    teacher: assignment.createdBy,
    active: true,
  });
  await Enrollment.create({ student: outsider._id, batch: otherBatch._id });

  const teacherClient = await loginAs("teacher@example.test");
  const uploadResp = await teacherClient.upload(
    `/api/assignments/${assignment._id}/resources`,
    pdfForm(),
  );
  assert.equal(uploadResp.status, 201);

  const studentClient = await loginAs("outsider@example.test");
  const downloadResp = await studentClient.download(
    `/api/assignments/${assignment._id}/resources/${uploadResp.data._id}/download`,
  );

  assert.equal(downloadResp.status, 404);
});
