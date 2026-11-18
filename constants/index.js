// Fixed values used across the app.
// If a word, status, limit or size is used in more than one file, it belongs here.

const ROLES = Object.freeze({
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
});

// Attendance can only be one of these three values.
const ATTENDANCE_STATUSES = Object.freeze(["present", "absent", "leave"]);

// A submission can only be in one of these states.
const SUBMISSION_STATUSES = Object.freeze(["submitted", "graded", "rejected"]);

// Whether a student may upload a new file after the first submission.
const RESUBMISSION_POLICIES = Object.freeze(["disabled", "allowed"]);

// List endpoints use these defaults. No client may ask for more than the max.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// Password and text length limits.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const TEMP_PASSWORD_LENGTH = 12;
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const ROLE_NAME_MAX_LENGTH = 50;
const BATCH_NAME_MAX_LENGTH = 120;
const ASSIGNMENT_TITLE_MAX_LENGTH = 160;
const ASSIGNMENT_DESCRIPTION_MAX_LENGTH = 5000;
const ASSIGNMENT_RUBRIC_MAX_LENGTH = 5000;
const FEEDBACK_MAX_LENGTH = 2000;
const GRADE_MAX_LENGTH = 10;
const SEARCH_MAX_LENGTH = 100;

// Upload limits. The multer limit is the hard stop; the assignment limit may be lower.
const GLOBAL_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILE_SIZE_MB_LIMIT = 250;
const MAX_SUBMISSIONS_PER_ASSIGNMENT = 1;

// A ZIP bomb is a tiny file that expands to a huge amount of data.
const ZIP_MAX_ENTRIES = 1000;
const ZIP_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const ZIP_MAX_COMPRESSION_RATIO = 100;

const ALLOWED_UPLOAD_EXTENSIONS = Object.freeze([".zip", ".pdf", ".txt"]);
const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
  "application/pdf",
  "text/plain",
]);

// AI feedback drafts. The AI only suggests; a teacher still saves the grade.
const AI_DRAFT_STATUSES = Object.freeze([
  "pending",
  "ready",
  "failed",
  "used",
  "edited",
  "discarded",
]);

// Notification types. Adding a type here keeps every feature in sync.
const NOTIFICATION_TYPES = Object.freeze({
  SUBMISSION_GRADED: "submission.graded",
  NEW_ASSIGNMENT: "new.assignment",
  PASSWORD_RESET: "password.reset",
  AI_DRAFT_READY: "ai.draft.ready",
  ANNOUNCEMENT: "announcement",
  RISK_FLAG: "risk.flag",
  EMAIL_VERIFICATION: "email.verify",
});

// A notification is either in-app only or also emailed to the recipient.
const NOTIFICATION_CHANNELS = Object.freeze(["inApp", "email"]);

// Announcement scope: a single batch or the whole school.
const ANNOUNCEMENT_SCOPES = Object.freeze(["batch", "school"]);

// Guardian read-only permission prefix.
const GUARDIAN_PERMISSION_PREFIX = "students.view.ownChild";

// Quiz auto-grading default.
const QUIZ_DEFAULT_SCORE = 0;

// Risk flag thresholds come from env, but the field names live here.
const RISK_FLAG_STATUSES = Object.freeze(["open", "resolved", "dismissed"]);

// Feature flag states.
const FEATURE_FLAG_STATUSES = Object.freeze(["enabled", "disabled"]);

// Timetable days of the week.
const DAYS_OF_WEEK = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// PDF report card template fields come from config, not the code.
const REPORT_CARD_TEMPLATE_FIELDS = Object.freeze(["schoolName", "logoPath"]);
const AI_DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const AI_DEFAULT_MODEL = "openai/gpt-oss-120b";
const AI_DEFAULT_MAX_INPUT_CHARS = 8000;
const AI_MIN_INPUT_CHARS = 2000;
const AI_MAX_INPUT_CHARS = 30000;
const AI_MAX_FILES = 40;
const AI_MAX_FILE_BYTES = 30 * 1024;
const AI_FEEDBACK_MAX_LENGTH = 1800;
const AI_FEEDBACK_ITEMS_MAX = 10;
const AI_FEEDBACK_ITEM_MAX_LENGTH = 300;
const AI_ERROR_MAX_LENGTH = 200;
const AI_MAX_ATTEMPTS = 4;
const AI_MAX_GENERATIONS = 8;
const AI_MAX_CONCURRENT_DRAFTS = 2;
const AI_REQUEST_TIMEOUT_MS = 60 * 1000;
const AI_RATE_LIMIT_MAX_WAIT_MS = 90 * 1000;
const AI_OTHER_ERROR_WAIT_MS = 30 * 1000;
const AI_RECOVERY_MIN_AGE_MS = 2 * 60 * 1000;

// Every unsafe request must send this header. It is a simple CSRF guard.
const CSRF_HEADER_NAME = "x-csrf-protection";
const CSRF_HEADER_VALUE = "1";

module.exports = {
  ROLES,
  ATTENDANCE_STATUSES,
  SUBMISSION_STATUSES,
  RESUBMISSION_POLICIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  TEMP_PASSWORD_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  BATCH_NAME_MAX_LENGTH,
  ASSIGNMENT_TITLE_MAX_LENGTH,
  ASSIGNMENT_DESCRIPTION_MAX_LENGTH,
  ASSIGNMENT_RUBRIC_MAX_LENGTH,
  FEEDBACK_MAX_LENGTH,
  GRADE_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
  GLOBAL_UPLOAD_MAX_BYTES,
  MAX_FILE_SIZE_MB_LIMIT,
  MAX_SUBMISSIONS_PER_ASSIGNMENT,
  ZIP_MAX_ENTRIES,
  ZIP_MAX_UNCOMPRESSED_BYTES,
  ZIP_MAX_COMPRESSION_RATIO,
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  AI_DRAFT_STATUSES,
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_MODEL,
  AI_DEFAULT_MAX_INPUT_CHARS,
  AI_MIN_INPUT_CHARS,
  AI_MAX_INPUT_CHARS,
  AI_MAX_FILES,
  AI_MAX_FILE_BYTES,
  AI_FEEDBACK_MAX_LENGTH,
  AI_FEEDBACK_ITEMS_MAX,
  AI_FEEDBACK_ITEM_MAX_LENGTH,
  AI_ERROR_MAX_LENGTH,
  AI_MAX_ATTEMPTS,
  AI_MAX_GENERATIONS,
  AI_MAX_CONCURRENT_DRAFTS,
  AI_REQUEST_TIMEOUT_MS,
  AI_RATE_LIMIT_MAX_WAIT_MS,
  AI_OTHER_ERROR_WAIT_MS,
  AI_RECOVERY_MIN_AGE_MS,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  ANNOUNCEMENT_SCOPES,
  GUARDIAN_PERMISSION_PREFIX,
  QUIZ_DEFAULT_SCORE,
  RISK_FLAG_STATUSES,
  FEATURE_FLAG_STATUSES,
  DAYS_OF_WEEK,
  REPORT_CARD_TEMPLATE_FIELDS,
};
