// Ownership tests: teacher B must never read or change teacher A's data.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Role = require("../models/Role");
const { ROLES } = require("../constants");
const { resetLoginRateLimits } = require("../utils/rateLimit");

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

async function createData() {
  const teacherA = await createUser("teacher.a@example.test", ROLES.TEACHER);
  const teacherB = await createUser("teacher.b@example.test", ROLES.TEACHER);
  const studentA = await createUser("student.a@example.test", ROLES.STUDENT);
  const studentB = await createUser("student.b@example.test", ROLES.STUDENT);
  const batchA = await createBatch("Batch A", teacherA._id);
  const batchB = await createBatch("Batch B", teacherB._id);
  await Enrollment.create({ student: studentA._id, batch: batchA._id });
  await Enrollment.create({ student: studentB._id, batch: batchB._id });

  return { teacherA, teacherB, studentA, studentB, batchA, batchB };
}

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

test("teachers may register students only in their own batches", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const baseStudent = {
    name: "New Student",
    email: "new.student@example.test",
    password: PASSWORD,
    role: ROLES.STUDENT,
  };

  const deniedRole = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    role: ROLES.TEACHER,
  });
  assert.equal(deniedRole.status, 403);

  const deniedBatch = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    email: "other.student@example.test",
    batchId: String(data.batchB._id),
  });
  assert.equal(deniedBatch.status, 403);

  const allowed = await teacherAClient.post("/api/auth/register", {
    ...baseStudent,
    email: "own.student@example.test",
    batchId: String(data.batchA._id),
  });
  assert.equal(allowed.status, 201);
});

test("enrolling in a new batch keeps the student's other enrollments", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  const response = await teacherAClient.post(`/api/batches/${data.batchA._id}/enroll`, {
    studentId: String(data.studentB._id),
  });

  assert.equal(response.status, 201);
  const batchBEnrollment = await Enrollment.exists({
    student: data.studentB._id,
    batch: data.batchB._id,
  });
  assert.ok(batchBEnrollment);
});

test("archiving a batch preserves history and permanent deletion is blocked", async () => {
  const data = await createData();
  const teacherAClient = await loginAs("teacher.a@example.test");
  assert.equal((await teacherAClient.delete(`/api/batches/${data.batchA._id}`)).status, 409);

  const response = await teacherAClient.patch(`/api/batches/${data.batchA._id}/archive`);

  assert.equal(response.status, 200);
  const storedBatch = await Batch.findById(data.batchA._id);
  assert.equal(storedBatch.active, false);
  assert.ok(storedBatch.archivedAt);
  assert.ok(await Enrollment.exists({ student: data.studentA._id, batch: data.batchA._id }));
});

test("deactivation, archive, and permanent user deletion are distinct", async () => {
  const admin = await createUser("admin@example.test", ROLES.ADMIN);
  const target = await createUser("target@example.test", ROLES.STUDENT);
  const client = await loginAs(admin.email);

  const deactivated = await client.patch(`/api/users/${target._id}`, {
    active: false,
  });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.data.active, false);
  assert.equal(deactivated.data.archivedAt, null);

  const archived = await client.patch(`/api/users/${target._id}/archive`);
  assert.equal(archived.status, 200);
  const storedUser = await User.findById(target._id);
  assert.equal(storedUser.active, false);
  assert.ok(storedUser.archivedAt);

  const restored = await client.patch(`/api/users/${target._id}`, {
    active: true,
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.active, true);
  assert.equal(restored.data.archivedAt, null);

  const deleted = await client.delete(`/api/users/${target._id}`);
  assert.equal(deleted.status, 200);
  assert.equal(await User.findById(target._id), null);
});

test("permanent user deletion is blocked when historical records are linked", async () => {
  const admin = await createUser("history.admin@example.test", ROLES.ADMIN);
  const teacher = await createUser("history.teacher@example.test", ROLES.TEACHER);
  const student = await createUser("history.student@example.test", ROLES.STUDENT);
  const batch = await createBatch("History batch", teacher._id);
  await Enrollment.create({ student: student._id, batch: batch._id });
  const client = await loginAs(admin.email);

  const response = await client.delete(`/api/users/${student._id}`);
  assert.equal(response.status, 409);
  assert.ok(await User.findById(student._id));
});

test("permanent deletion removes an unused batch but protects batches with history", async () => {
  const admin = await createUser("batch.admin@example.test", ROLES.ADMIN);
  const teacher = await createUser("batch.teacher@example.test", ROLES.TEACHER);
  const unused = await createBatch("Unused batch", teacher._id);
  const client = await loginAs(admin.email);

  const response = await client.delete(`/api/batches/${unused._id}`);
  assert.equal(response.status, 200);
  assert.equal(await Batch.findById(unused._id), null);
});

test("admins can delete unused custom roles but cannot delete core or assigned roles", async () => {
  const admin = await createUser("role.admin@example.test", ROLES.ADMIN);
  const client = await loginAs(admin.email);
  assert.equal((await client.get("/api/roles")).status, 200);

  const coreRole = await Role.findOne({ name: ROLES.ADMIN });
  const coreDelete = await client.delete(`/api/roles/${coreRole._id}`);
  assert.equal(coreDelete.status, 400);

  const customRole = await Role.create({
    name: "temporary",
    label: "Temporary",
    permissions: [],
  });
  const deleted = await client.delete(`/api/roles/${customRole._id}`);
  assert.equal(deleted.status, 200);
  assert.equal(await Role.findById(customRole._id), null);

  const assignedRole = await Role.create({
    name: "assigned",
    label: "Assigned",
    permissions: [],
  });
  const assignedUser = await createUser("role.assigned@example.test", ROLES.STUDENT);
  await User.collection.updateOne({ _id: assignedUser._id }, { $set: { role: assignedRole.name } });
  const blocked = await client.delete(`/api/roles/${assignedRole._id}`);
  assert.equal(blocked.status, 409);
  assert.ok(await Role.findById(assignedRole._id));
});
