// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { createUser, createBatch, loginAs, createData } = configurePermissionTests();
const { ROLES } = require("../constants");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
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
