// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { loginAs, createData } = configurePermissionTests();
test("attendance leave with reason saves", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
    leaveReason: "Illness",
  };

  const allowed = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.data.leaveReason, "Illness");
});

test("attendance accepts local today and still rejects local future dates", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const timezoneOffset = -300;
  const localToday = new Date(Date.now() - timezoneOffset * 60 * 1000);
  const today = localToday.toISOString().slice(0, 10);
  const tomorrowDate = new Date(localToday);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const body = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    status: "present",
    timezoneOffset,
  };

  const todayResult = await teacherAClient.post("/api/attendance", {
    ...body,
    date: today,
  });
  assert.equal(todayResult.status, 200);

  const tomorrowResult = await teacherAClient.post("/api/attendance", {
    ...body,
    date: tomorrow,
  });
  assert.equal(tomorrowResult.status, 400);
});

test("attendance leave without reason returns 400", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
  };

  const result = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(result.status, 400);
});

test("attendance reason with present status returns 400", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "present",
    leaveReason: "Some reason",
  };

  const result = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(result.status, 400);
});

test("student sees own leaveReason in attendance records", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const studentAClient = await loginAs("student.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
    leaveReason: "Appointment",
  };

  await teacherAClient.post("/api/attendance", attendanceBody);
  const result = await studentAClient.get(`/api/attendance/${data.studentA._id}`);
  assert.equal(result.status, 200);
  const leaveRecord = result.data.records.find((r) => r.status === "leave");
  assert.ok(leaveRecord);
  assert.equal(leaveRecord.leaveReason, "Appointment");
});

test("other batch's teacher cannot manage attendance", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchB._id),
    date: "2026-10-30",
    status: "present",
  };

  const result = await teacherAClient.post("/api/attendance", attendanceBody);
  assert.equal(result.status, 403);
});
