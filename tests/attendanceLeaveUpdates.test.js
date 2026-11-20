// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { loginAs, createData } = configurePermissionTests();
test("leave -> present clears the reason (POST)", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const attendanceBody = {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
    leaveReason: "Illness",
  };
  await teacherAClient.post("/api/attendance", attendanceBody);
  const result = await teacherAClient.post("/api/attendance", {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "present",
  });
  assert.equal(result.status, 200);
  assert.ok(!result.data.leaveReason || result.data.leaveReason === "");
});

test("PATCH present -> leave with reason works", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  // First POST a present record
  const postResult = await teacherAClient.post("/api/attendance", {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "present",
  });
  const attendanceId = postResult.data._id;
  // Then PATCH it to leave with reason
  const result = await teacherAClient.patch(`/api/attendance/${attendanceId}`, {
    status: "leave",
    leaveReason: "Appointment",
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.leaveReason, "Appointment");
});

test("PATCH leave -> absent clears the reason", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const created = await teacherAClient.post("/api/attendance", {
    studentId: String(data.studentA._id),
    batchId: String(data.batchA._id),
    date: "2026-10-30",
    status: "leave",
    leaveReason: "Illness",
  });

  const result = await teacherAClient.patch(`/api/attendance/${created.data._id}`, {
    status: "absent",
  });

  assert.equal(result.status, 200);
  assert.equal(result.data.status, "absent");
  assert.equal(result.data.leaveReason, undefined);
});
