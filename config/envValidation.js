// Validate required server environment values.
// Errors are accumulated so startup reports all missing or unsafe settings at once.

const MINIMUM_JWT_SECRET_LENGTH = 64;
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

function checkJwtSecret(secret, problems) {
  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters long.`);
  }
  const lowerCaseSecret = secret.toLowerCase();
  if (EXAMPLE_SECRET_PARTS.some((part) => lowerCaseSecret.includes(part))) {
    problems.push("JWT_SECRET looks like an example value. Use a real random secret.");
  }
  if (new Set(secret).size < 8) {
    problems.push("JWT_SECRET is not random enough.");
  }
}

function checkMongoUri(uri, problems) {
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
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

function validateCoreSettings(source) {
  const problems = [];
  const mongoUri = readRequiredValue(source, "MONGO_URI", problems);
  const jwtSecret = readRequiredValue(source, "JWT_SECRET", problems);
  const frontendUrl = readRequiredValue(source, "FRONTEND_URL", problems);

  if (mongoUri) checkMongoUri(mongoUri, problems);
  if (jwtSecret) checkJwtSecret(jwtSecret, problems);
  if (frontendUrl) checkFrontendUrl(frontendUrl, problems);

  return {
    problems,
    mongoUri,
    jwtSecret,
    frontendUrl,
    port: readPort(source, problems),
  };
}

module.exports = { MINIMUM_JWT_SECRET_LENGTH, validateCoreSettings };
