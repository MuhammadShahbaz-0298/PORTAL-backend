// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { loginAs, createData } = configurePermissionTests();
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
test("teacher B cannot read or change teacher A's batches and students", async () => {
  const data = await createData();
  const teacherBClient = await loginAs("teacher.b@example.test");

  const batches = await teacherBClient.get("/api/batches");
  assert.equal(batches.status, 200);
  const batchIds = batches.data.map((batch) => String(batch._id));
  assert.ok(!batchIds.includes(String(data.batchA._id)));

  const users = await teacherBClient.get("/api/users");
  assert.equal(users.status, 200);
  const emails = users.data.map((user) => user.email);
  assert.ok(emails.includes("student.b@example.test"));
  assert.ok(!emails.includes("student.a@example.test"));

  const attendance = await teacherBClient.get(`/api/attendance?batchId=${data.batchA._id}`);
  assert.equal(attendance.status, 200);
  assert.equal(attendance.data.length, 0);

  const assignments = await teacherBClient.get(`/api/assignments?batchId=${data.batchA._id}`);
  assert.equal(assignments.status, 200);
  assert.equal(assignments.data.length, 0);

  assert.equal(
    (await teacherBClient.patch(`/api/batches/${data.batchA._id}`, { name: "Hacked" })).status,
    403,
  );
  assert.equal((await teacherBClient.delete(`/api/batches/${data.batchA._id}`)).status, 403);
  assert.equal((await teacherBClient.get(`/api/batches/${data.batchA._id}/students`)).status, 403);
  assert.equal(
    (
      await teacherBClient.post(`/api/batches/${data.batchA._id}/enroll`, {
        studentId: String(data.studentB._id),
      })
    ).status,
    403,
  );
});

test("attendance can only be managed for an owned batch", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const teacherBClient = await loginAs("teacher.b@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "present",
  };

  const allowed = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(allowed.status, 200);

  const denied = await teacherBClient.post("/api/attendance", attendanceBody);
  assert.equal(denied.status, 403);
});

test("a teacher cannot grade another teacher's submission", async () => {
  const data = await createData();
  const assignment = await Assignment.create({
    batch: data.batchA._id,
    title: "Owned assignment",
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    allowedFileTypes: ["zip"],
    maxFileSizeMb: 25,
    resubmissionPolicy: "allowed",
    createdBy: data.teacherA._id,
    active: true,
  });
  const submission = await Submission.create({
    assignment: assignment._id,
    student: data.studentA._id,
    batch: data.batchA._id,
    filePath: "dummy.zip",
    fileName: "dummy.zip",
    fileSize: 100,
  });

  const teacherBClient = await loginAs("teacher.b@example.test");
  const denied = await teacherBClient.patch(`/api/submissions/${submission._id}/grade`, {
    grade: "90",
  });
  assert.equal(denied.status, 403);

  const teacherAClient = await loginAs("teacher.a@example.test");
  const allowed = await teacherAClient.patch(`/api/submissions/${submission._id}/grade`, {
    grade: "90",
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.data.grade, "90");
});

test("a student cannot read another student's attendance", async () => {
  const data = await createData();
  const studentAClient = await loginAs("student.a@example.test");

  assert.equal((await studentAClient.get(`/api/attendance/${data.studentB._id}`)).status, 403);
  assert.equal((await studentAClient.get(`/api/attendance/${data.studentA._id}`)).status, 200);
});
