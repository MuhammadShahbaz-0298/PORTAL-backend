// Constants for announcements, notifications, risk flags and calendar events.
// Feature-specific values are collected here and re-exported by constants/index.js.

const EVENT_TITLE_MAX_LENGTH = 200;
const EVENT_DESCRIPTION_MAX_LENGTH = 2000;
const NOTIFICATION_TYPES = Object.freeze({
  SUBMISSION_GRADED: "submission.graded",
  NEW_ASSIGNMENT: "new.assignment",
  NEW_QUIZ: "new.quiz",
  PASSWORD_RESET: "password.reset",
  AI_DRAFT_READY: "ai.draft.ready",
  ANNOUNCEMENT: "announcement",
  RISK_FLAG: "risk.flag",
  EVENT: "event.created",
});
const NOTIFICATION_CHANNELS = Object.freeze(["inApp"]);
const ANNOUNCEMENT_SCOPES = Object.freeze(["batch", "school"]);
const QUIZ_DEFAULT_SCORE = 0;
const QUIZ_MAX_TIME_LIMIT_MINUTES = 1440;
const QUIZ_ATTEMPT_STATUSES = Object.freeze({
  IN_PROGRESS: "inProgress",
  SUBMITTED: "submitted",
});
const RISK_FLAG_STATUSES = Object.freeze(["open", "resolved", "dismissed"]);
const FEATURE_FLAG_STATUSES = Object.freeze(["enabled", "disabled"]);
const DAYS_OF_WEEK = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const REPORT_CARD_TEMPLATE_FIELDS = Object.freeze(["schoolName", "logoPath"]);

module.exports = {
  EVENT_TITLE_MAX_LENGTH,
  EVENT_DESCRIPTION_MAX_LENGTH,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  ANNOUNCEMENT_SCOPES,
  QUIZ_DEFAULT_SCORE,
  QUIZ_MAX_TIME_LIMIT_MINUTES,
  QUIZ_ATTEMPT_STATUSES,
  RISK_FLAG_STATUSES,
  FEATURE_FLAG_STATUSES,
  DAYS_OF_WEEK,
  REPORT_CARD_TEMPLATE_FIELDS,
};
