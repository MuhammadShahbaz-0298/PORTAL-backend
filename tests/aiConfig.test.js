// Tests that optional AI settings never stop the server from starting.

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadEnvironment, readAiSettings } = require("../config/env");

const VALID_ENVIRONMENT = {
  MONGO_URI: "mongodb://localhost:27017/school-portal",
  JWT_SECRET: "9f2c1a7e4b8d3f6a0c5e2b9d7f4a1c8e6b3d0f9a2c7e5b8d1f4a6c3e9b0d7f2a",
  FRONTEND_URL: "http://localhost:5173",
};

test("server settings load with no AI key", () => {
  const environment = loadEnvironment(VALID_ENVIRONMENT);

  assert.equal(environment.ai.enabled, false);
  assert.equal(environment.ai.apiKey, "");
  assert.equal(environment.ai.model, "openai/gpt-oss-120b");
  assert.equal(environment.ai.maxInputChars, 8000);
});

test("AI is off when AI_ENABLED is the text false", () => {
  const settings = readAiSettings({ AI_API_KEY: "test-key", AI_ENABLED: "false" });
  assert.equal(settings.enabled, false);
});

test("AI input characters are clamped to the safe range", () => {
  assert.equal(readAiSettings({ AI_MAX_INPUT_CHARS: "10" }).maxInputChars, 2000);
  assert.equal(readAiSettings({ AI_MAX_INPUT_CHARS: "999999" }).maxInputChars, 30000);
  assert.equal(readAiSettings({ AI_MAX_INPUT_CHARS: "not-a-number" }).maxInputChars, 8000);
});

test("the Express app loads without an AI key", () => {
  process.env.FRONTEND_URL = "http://localhost:5173";
  delete process.env.AI_API_KEY;

  assert.doesNotThrow(() => require("../app"));
});
