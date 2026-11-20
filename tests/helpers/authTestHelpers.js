// Shared session fixtures for authentication integration tests.
// The environment resets the in-memory database and lockout state per test.

const { before, after, beforeEach } = require("node:test");
const { startTestEnvironment } = require("./integration");
const User = require("../../models/User");
const { ROLES } = require("../../constants");
const { resetLoginRateLimits } = require("../../utils/rateLimit");

const PASSWORD = "Password123!";

function configureAuthTests() {
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

  async function createUser(overrides = {}) {
    return User.create({
      name: "Test User",
      email: "user@example.test",
      password: PASSWORD,
      role: ROLES.STUDENT,
      active: true,
      ...overrides,
    });
  }

  async function login(client, email) {
    return client.post("/api/auth/login", { email, password: PASSWORD });
  }

  return { createUser, login, PASSWORD, getEnvironment: () => environment };
}

module.exports = { configureAuthTests };
