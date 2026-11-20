// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { loginAs, createData } = configurePermissionTests();
const Attendance = require("../models/Attendance");
test("PATCHing an old reasonless leave record's date works", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const record = await Attendance.create({
    student: data.studentA._id,
    batch: data.batchA._id,
    batchName: data.batchA.name,
    date: new Date("2026-10-30T00:00:00.000Z"),
    status: "leave",
    enteredBy: data.teacherA._id,
  });

  const result = await teacherAClient.patch(`/api/attendance/${record._id}`, {
    date: "2026-10-31",
  });

  assert.equal(result.status, 200);
  assert.equal(result.data.status, "leave");
  assert.equal(result.data.leaveReason, undefined);
  assert.equal(result.data.date, "2026-10-31T00:00:00.000Z");
});

test("PATCHing status to leave without a reason returns 400", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const present = await teacherAClient.post("/api/attendance", {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "present",
  });

  const result = await teacherAClient.patch(`/api/attendance/${present.data._id}`, {
    status: "leave",
  });

  assert.equal(result.status, 400);
});

test("whitespace-only reason -> 400", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
  };
  attendanceBody.leaveReason = "   ";
  const result = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(result.status, 400);
});
