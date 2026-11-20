// Optional settings for background and AI services.
// Invalid at-risk settings are reported during normal startup validation.

const cron = require("node-cron");
const {
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_MAX_INPUT_CHARS,
  AI_DEFAULT_MODEL,
  AI_MAX_INPUT_CHARS,
  AI_MIN_INPUT_CHARS,
} = require("../constants");

function readAiSettings(source = process.env) {
  const apiKey = typeof source.AI_API_KEY === "string" ? source.AI_API_KEY.trim() : "";
  const enabledText =
    source.AI_ENABLED === undefined ? "true" : String(source.AI_ENABLED).trim().toLowerCase();
  const enabled = apiKey.length > 0 && enabledText !== "false";

  const rawBaseUrl =
    typeof source.AI_BASE_URL === "string" ? source.AI_BASE_URL.trim().replace(/\/+$/, "") : "";
  const baseUrl =
    rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://")
      ? rawBaseUrl
      : AI_DEFAULT_BASE_URL;

  const rawModel = typeof source.AI_MODEL === "string" ? source.AI_MODEL.trim() : "";
  const model = rawModel || AI_DEFAULT_MODEL;

  const requestedMaxChars = Number(source.AI_MAX_INPUT_CHARS);
  const safeMaxChars = Number.isInteger(requestedMaxChars)
    ? requestedMaxChars
    : AI_DEFAULT_MAX_INPUT_CHARS;
  const maxInputChars = Math.min(AI_MAX_INPUT_CHARS, Math.max(AI_MIN_INPUT_CHARS, safeMaxChars));

  return { enabled, apiKey, baseUrl, model, maxInputChars };
}

function readAtRiskSettings(source = process.env) {
  const enabled =
    String(source.AT_RISK_DETECTION_ENABLED || "false")
      .trim()
      .toLowerCase() === "true";

  if (!enabled) {
    return {
      enabled: false,
      attendanceThreshold: null,
      missedSubmissionThreshold: null,
      schedule: "",
    };
  }

  const attendanceThreshold = Number(source.AT_RISK_ATTENDANCE_THRESHOLD);
  const missedSubmissionThreshold = Number(source.AT_RISK_MISSED_SUBMISSIONS);
  const schedule = String(source.AT_RISK_SCHEDULE || "").trim();

  if (
    !Number.isFinite(attendanceThreshold) ||
    attendanceThreshold < 0 ||
    attendanceThreshold > 100
  ) {
    throw new Error("AT_RISK_ATTENDANCE_THRESHOLD must be a number between 0 and 100.");
  }

  if (!Number.isInteger(missedSubmissionThreshold) || missedSubmissionThreshold < 0) {
    throw new Error("AT_RISK_MISSED_SUBMISSIONS must be a whole number of zero or greater.");
  }

  if (!schedule || !cron.validate(schedule)) {
    throw new Error("AT_RISK_SCHEDULE must be a valid cron expression.");
  }

  return { enabled, attendanceThreshold, missedSubmissionThreshold, schedule };
}

module.exports = { readAiSettings, readAtRiskSettings };
