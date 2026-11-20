// Tests for n ov er if ic at io nl og in.t es t.
// Verifies observable behavior without depending on test order.
const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const User = require("../models/User");
const { ROLES } = require("../constants");

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
  await ensureCoreRoles();
});

async function createUser(email, role) {
  return User.create({ name: email, email, password: PASSWORD, role, active: true });
}
async function loginAs(email) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", { email, password: PASSWORD });
  assert.equal(response.status, 200);
  return client;
}

test("login works for a user created without optional account fields", async () => {
  await createUser("plain@example.test", ROLES.STUDENT);
  const client = await loginAs("plain@example.test");
  const me = await client.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.email, "plain@example.test");
});
