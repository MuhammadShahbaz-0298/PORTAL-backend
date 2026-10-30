// Fixed values used across the app.
// If a word, status, limit or size is used in more than one file, it belongs here.

const ROLES = Object.freeze({
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
});

const ROLE_NAMES = Object.freeze(Object.values(ROLES));

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
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const ROLE_NAME_MAX_LENGTH = 50;
const BATCH_NAME_MAX_LENGTH = 120;
const ASSIGNMENT_TITLE_MAX_LENGTH = 160;
const ASSIGNMENT_DESCRIPTION_MAX_LENGTH = 5000;
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

const ALLOWED_UPLOAD_EXTENSIONS = Object.freeze([".zip"]);
const ALLOWED_UPLOAD_MIME_TYPES = Object.freeze([
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

// Every unsafe request must send this header. It is a simple CSRF guard.
const CSRF_HEADER_NAME = "x-csrf-protection";
const CSRF_HEADER_VALUE = "1";

module.exports = {
  ROLES,
  ROLE_NAMES,
  ATTENDANCE_STATUSES,
  SUBMISSION_STATUSES,
  RESUBMISSION_POLICIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  BATCH_NAME_MAX_LENGTH,
  ASSIGNMENT_TITLE_MAX_LENGTH,
  ASSIGNMENT_DESCRIPTION_MAX_LENGTH,
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
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
};
