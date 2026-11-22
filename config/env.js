// This file reads and checks the environment variables the server cannot run without.
// The server must fail fast, before it listens, if a required value is missing or unsafe.

// A JWT secret shorter than this can be brute-forced, so we refuse to start.
const { readAuthSettings } = require("./auth");
const { readAiSettings, readAtRiskSettings, readPushSettings } = require("./serviceSettings");
const { MINIMUM_JWT_SECRET_LENGTH, validateCoreSettings } = require("./envValidation");

// The whole check lives in one function so tests can pass a fake environment.
function loadEnvironment(source = process.env) {
  const { problems, mongoUri, jwtSecret, frontendUrl, port } = validateCoreSettings(source);

  let authSettings;
  try {
    authSettings = readAuthSettings(source);
  } catch (error) {
    problems.push(error.message);
  }

  let atRiskSettings;
  try {
    atRiskSettings = readAtRiskSettings(source);
  } catch (error) {
    problems.push(error.message);
  }

  if (problems.length > 0) {
    const lines = ["Server cannot start:"];
    for (const problem of problems) {
      lines.push(`- ${problem}`);
    }
    throw new Error(lines.join("\n"));
  }

  return {
    port,
    mongoUri,
    jwtSecret,
    frontendUrl,
    nodeEnv: source.NODE_ENV || "development",
    auth: authSettings,
    ai: readAiSettings(source),
    atRisk: atRiskSettings,
    push: readPushSettings(source),
  };
}

module.exports = {
  loadEnvironment,
  readAiSettings,
  readAtRiskSettings,
  readPushSettings,
  MINIMUM_JWT_SECRET_LENGTH,
};
