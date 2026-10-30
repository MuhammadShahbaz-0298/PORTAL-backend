// Tests for the admin-only temporary password reset.
// Covers generation, hashing, session revocation, the change-password block and permissions.

const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const bcrypt = require("bcryptjs");
const { startTestEnvironment } = require("./helpers/integration");
const User = require("../models/User");
const { ROLES } = require("../constants");
const { resetLoginRateLimits } = require("../utils/rateLimit");

const PASSWORD = "Password123!";
const NEW_PASSWORD = "NewPassword123!";
const TEMPORARY_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12}$/;

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

async function createUser({ email, role = ROLES.STUDENT }) {
  return User.create({ name: email, email, password: PASSWORD, role, active: true });
}

async function loginAs(email, password = PASSWORD) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", { email, password });
  assert.equal(response.status, 200);
  return client;
}

async function createAdminAndStudent() {
  const admin = await createUser({ email: "admin@example.test", role: ROLES.ADMIN });
  const student = await createUser({ email: "student@example.test" });
  return { admin, student };
}

async function resetPassword(adminClient, userId) {
  return adminClient.patch(`/api/users/${userId}/reset-password`);
}

test("an admin reset returns a 12-character temporary password and flags the user", async () => {
  const { admin, student } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);

  const response = await resetPassword(adminClient, student._id);

  assert.equal(response.status, 200);
  assert.match(response.data.temporaryPassword, TEMPORARY_PASSWORD_PATTERN);
  assert.equal(response.data.temporaryPassword.length, 12);

  const storedUser = await User.findById(student._id).select("+password");
  assert.equal(storedUser.mustChangePassword, true);
  assert.notEqual(storedUser.password, response.data.temporaryPassword);
  assert.equal(await bcrypt.compare(response.data.temporaryPassword, storedUser.password), true);
});

test("the temporary password works for login", async () => {
  const { admin, student } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);
  const reset = await resetPassword(adminClient, student._id);

  const client = environment.createClient();
  const login = await client.post("/api/auth/login", {
    email: student.email,
    password: reset.data.temporaryPassword,
  });

  assert.equal(login.status, 200);
  assert.equal(login.data.user.email, student.email);
});

test("resetting a password revokes that user's existing sessions", async () => {
  const { admin, student } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);
  const studentClient = await loginAs(student.email);

  assert.equal((await studentClient.get("/api/auth/me")).status, 200);
  assert.equal((await resetPassword(adminClient, student._id)).status, 200);

  const me = await studentClient.get("/api/auth/me");
  assert.equal(me.status, 401);
});

test("a user with a temporary password is blocked from every other route", async () => {
  const { admin, student } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);
  const reset = await resetPassword(adminClient, student._id);
  const studentClient = await loginAs(student.email, reset.data.temporaryPassword);

  for (const route of ["/api/auth/me", "/api/batches", "/api/users"]) {
    const response = await studentClient.get(route);
    assert.equal(response.status, 403);
    assert.equal(response.data.error, "You must change your password before continuing.");
  }
});

test("changing the password clears the block", async () => {
  const { admin, student } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);
  const reset = await resetPassword(adminClient, student._id);
  const studentClient = await loginAs(student.email, reset.data.temporaryPassword);

  const changed = await studentClient.post("/api/auth/change-password", {
    currentPassword: reset.data.temporaryPassword,
    newPassword: NEW_PASSWORD,
  });
  assert.equal(changed.status, 200);

  const me = await studentClient.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.mustChangePassword, false);

  const newClient = environment.createClient();
  const login = await newClient.post("/api/auth/login", {
    email: student.email,
    password: NEW_PASSWORD,
  });
  assert.equal(login.status, 200);
});

test("an admin cannot reset their own password this way", async () => {
  const { admin } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);

  const response = await resetPassword(adminClient, admin._id);

  assert.equal(response.status, 400);
  assert.equal(response.data.error, "You cannot reset your own password this way.");
});

test("a non-admin cannot reset another user's password", async () => {
  const { student } = await createAdminAndStudent();
  const teacher = await createUser({ email: "teacher@example.test", role: ROLES.TEACHER });
  const teacherClient = await loginAs(teacher.email);

  const response = await resetPassword(teacherClient, student._id);

  assert.equal(response.status, 403);
});

test("resetting an unknown user returns 404", async () => {
  const { admin } = await createAdminAndStudent();
  const adminClient = await loginAs(admin.email);

  const response = await resetPassword(adminClient, "507f1f77bcf86cd799439011");

  assert.equal(response.status, 404);
  assert.equal(response.data.error, "User not found.");
});
