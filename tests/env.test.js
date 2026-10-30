// Tests for the startup environment guard.
// A bad deploy must stop before the server starts listening.

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadEnvironment, MINIMUM_JWT_SECRET_LENGTH } = require("../config/env");
const { readAuthSettings, readCookieSettings } = require("../config/auth");

const REAL_LOOKING_SECRET = "9f2c1a7e4b8d3f6a0c5e2b9d7f4a1c8e6b3d0f9a2c7e5b8d1f4a6c3e9b0d7f2a";
const VALID_ENVIRONMENT = {
  MONGO_URI: "mongodb://localhost:27017/school-portal",
  JWT_SECRET: REAL_LOOKING_SECRET,
  FRONTEND_URL: "http://localhost:5173",
};

test("accepts a complete, safe environment", () => {
  const environment = loadEnvironment(VALID_ENVIRONMENT);

  assert.equal(environment.port, 5000);
  assert.equal(environment.mongoUri, VALID_ENVIRONMENT.MONGO_URI);
  assert.equal(environment.frontendUrl, VALID_ENVIRONMENT.FRONTEND_URL);
  assert.equal(environment.nodeEnv, "development");
});

test("refuses to start when a required variable is missing", () => {
  assert.throws(
    () =>
      loadEnvironment({ JWT_SECRET: REAL_LOOKING_SECRET, FRONTEND_URL: "http://localhost:5173" }),
    /MONGO_URI is missing/,
  );
  assert.throws(
    () =>
      loadEnvironment({
        MONGO_URI: VALID_ENVIRONMENT.MONGO_URI,
        FRONTEND_URL: "http://localhost:5173",
      }),
    /JWT_SECRET is missing/,
  );
  assert.throws(
    () =>
      loadEnvironment({ MONGO_URI: VALID_ENVIRONMENT.MONGO_URI, JWT_SECRET: REAL_LOOKING_SECRET }),
    /FRONTEND_URL is missing/,
  );
});

test("refuses a JWT secret that is too short", () => {
  const environment = {
    ...VALID_ENVIRONMENT,
    JWT_SECRET: "a".repeat(MINIMUM_JWT_SECRET_LENGTH - 1),
  };

  assert.throws(() => loadEnvironment(environment), /JWT_SECRET must be at least/);
});

test("refuses a JWT secret that looks like an example", () => {
  const environment = {
    ...VALID_ENVIRONMENT,
    JWT_SECRET: "change_this_to_a_long_random_string_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };

  assert.throws(() => loadEnvironment(environment), /looks like an example value/);
});

test("refuses a JWT secret with too few different characters", () => {
  const environment = {
    ...VALID_ENVIRONMENT,
    JWT_SECRET: "ab".repeat(40),
  };

  assert.throws(() => loadEnvironment(environment), /not random enough/);
});

test("refuses invalid database and frontend addresses", () => {
  assert.throws(
    () => loadEnvironment({ ...VALID_ENVIRONMENT, MONGO_URI: "http://example.com" }),
    /MONGO_URI must start with/,
  );
  assert.throws(
    () => loadEnvironment({ ...VALID_ENVIRONMENT, FRONTEND_URL: "not-a-url" }),
    /FRONTEND_URL must be a full URL/,
  );
  assert.throws(
    () => loadEnvironment({ ...VALID_ENVIRONMENT, FRONTEND_URL: "ftp://example.com" }),
    /FRONTEND_URL must start with/,
  );
});

test("refuses an invalid port", () => {
  assert.throws(() => loadEnvironment({ ...VALID_ENVIRONMENT, PORT: "abc" }), /PORT must be/);
  assert.throws(() => loadEnvironment({ ...VALID_ENVIRONMENT, PORT: "70000" }), /PORT must be/);
});

test("refuses an access token that lives longer than the idle timeout", () => {
  assert.throws(
    () =>
      loadEnvironment({
        ...VALID_ENVIRONMENT,
        ACCESS_TOKEN_MINUTES: "30",
        IDLE_TIMEOUT_MINUTES: "10",
      }),
    /must not be longer than IDLE_TIMEOUT_MINUTES/,
  );
});

test("reads token times from the environment", () => {
  const settings = readAuthSettings({
    ACCESS_TOKEN_MINUTES: "5",
    IDLE_TIMEOUT_MINUTES: "15",
    REFRESH_TOKEN_DAYS: "3",
    SESSION_MAX_HOURS: "12",
  });

  assert.equal(settings.accessTokenMinutes, 5);
  assert.equal(settings.idleTimeoutMinutes, 15);
  assert.equal(settings.refreshTokenDays, 3);
  assert.equal(settings.sessionMaxHours, 12);
});

test("production cookies are cross-site safe", () => {
  const production = readCookieSettings({ NODE_ENV: "production" });
  assert.equal(production.sameSite, "none");
  assert.equal(production.secure, true);
  assert.equal(production.httpOnly, true);

  const development = readCookieSettings({ NODE_ENV: "development" });
  assert.equal(development.sameSite, "lax");
  assert.equal(development.secure, false);
});
