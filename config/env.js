// This file reads and checks the environment variables the server cannot run without.
// The server must fail fast, before it listens, if a required value is missing or unsafe.

// A JWT secret shorter than this can be brute-forced, so we refuse to start.
const { readAuthSettings } = require("./auth");

const MINIMUM_JWT_SECRET_LENGTH = 64;

// Values that look like documentation examples, not real secrets.
const EXAMPLE_SECRET_PARTS = [
  "change_this",
  "changeme",
  "change-me",
  "example",
  "your_secret",
  "your-secret",
  "secret_here",
  "replace_me",
  "replace-me",
  "test_secret",
  "test-secret",
  "password",
  "jwt_secret",
  "jwt-secret",
];

function readRequiredValue(source, name, problems) {
  const value = source[name];

  if (typeof value !== "string") {
    problems.push(`${name} is missing.`);
    return "";
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    problems.push(`${name} is missing.`);
  }

  return trimmedValue;
}

function looksLikeExampleSecret(secret) {
  const lowerCaseSecret = secret.toLowerCase();

  for (const examplePart of EXAMPLE_SECRET_PARTS) {
    if (lowerCaseSecret.includes(examplePart)) {
      return true;
    }
  }

  return false;
}

// A long secret made of only a few different characters is still easy to guess.
function hasTooFewDifferentCharacters(secret) {
  const differentCharacters = new Set(secret);
  return differentCharacters.size < 8;
}

function checkJwtSecret(secret, problems) {
  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters long.`);
  }

  if (looksLikeExampleSecret(secret)) {
    problems.push("JWT_SECRET looks like an example value. Use a real random secret.");
  }

  if (hasTooFewDifferentCharacters(secret)) {
    problems.push("JWT_SECRET is not random enough.");
  }
}

function checkMongoUri(uri, problems) {
  const isMongoUri = uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");

  if (!isMongoUri) {
    problems.push("MONGO_URI must start with mongodb:// or mongodb+srv://.");
  }
}

function checkFrontendUrl(frontendUrl, problems) {
  let parsedUrl;

  try {
    parsedUrl = new URL(frontendUrl);
  } catch {
    problems.push("FRONTEND_URL must be a full URL such as https://portal.example.com.");
    return;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    problems.push("FRONTEND_URL must start with http:// or https://.");
  }
}

function readPort(source, problems) {
  const rawPort = source.PORT || "5000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push("PORT must be a whole number between 1 and 65535.");
    return 5000;
  }

  return port;
}

// The whole check lives in one function so tests can pass a fake environment.
function loadEnvironment(source = process.env) {
  const problems = [];
  const mongoUri = readRequiredValue(source, "MONGO_URI", problems);
  const jwtSecret = readRequiredValue(source, "JWT_SECRET", problems);
  const frontendUrl = readRequiredValue(source, "FRONTEND_URL", problems);

  if (mongoUri) {
    checkMongoUri(mongoUri, problems);
  }

  if (jwtSecret) {
    checkJwtSecret(jwtSecret, problems);
  }

  if (frontendUrl) {
    checkFrontendUrl(frontendUrl, problems);
  }

  const port = readPort(source, problems);

  let authSettings;
  try {
    authSettings = readAuthSettings(source);
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
  };
}

module.exports = { loadEnvironment, MINIMUM_JWT_SECRET_LENGTH };
