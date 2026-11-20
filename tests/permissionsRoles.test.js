// Integration tests for permission boundaries and ownership rules.
// Shared fixtures keep each test independent and database-backed.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePermissionTests } = require("./helpers/permissionTestHelpers");
const { createUser, loginAs } = configurePermissionTests();
const User = require("../models/User");
const Role = require("../models/Role");
const { ROLES } = require("../constants");
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
