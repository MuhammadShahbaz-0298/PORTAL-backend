// The one list of permissions and the default permissions for each core role.
// Custom roles are stored in MongoDB, but these defaults are the starting point.

const { PERMISSION_META } = require("./permissionMetadata");
const { PERMISSIONS, normalizePermissions } = require("./permissionCatalog");

// Teachers may take attendance and grade submissions for their own batches.
// students.view and students.create keep the existing teacher user screen working.
const TEACHER_PERMISSIONS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "batches.view",
  "batches.update",
  "batches.delete",
  "batches.enroll",
  "assignments.view",
  "assignments.create",
  "assignments.update",
  "assignments.delete",
  "submissions.view",
  "submissions.grade",
  "attendance.view",
  "attendance.manage",
  "timetable.view",
  "timetable.manage",
  "calendar.view",
  "events.view",
  "events.manage",
  "profile.view",
  "notifications.view",
  "announcements.view",
  "announcements.manage",
  "comments.view",
  "comments.create",
  "quiz.view",
  "quiz.manage",
  "grades.view",
  "analytics.view",
  "search.use",
  "assignments.resources.upload",
  "assignments.resources.view",
  "assignments.resources.download",
  "assignments.resources.delete",
  "attendance.export",
  "submissions.export",
];

const ROLE_DEFAULTS = {
  admin: PERMISSIONS,
  teacher: TEACHER_PERMISSIONS,
  student: [
    "dashboard.view",
    "assignments.view",
    "submissions.view",
    "attendance.view",
    "profile.view",
    "notifications.view",
    "comments.view",
    "comments.create",
    "quiz.view",
    "grades.view",
    "announcements.view",
    "timetable.view",
    "calendar.view",
    "events.view",
    "search.use",
    "assistant.use",
    "assignments.resources.view",
    "assignments.resources.download",
  ],
};

// The migration script adds these to existing teacher roles so nobody loses access.
const TEACHER_MIGRATION_PERMISSIONS = [
  "attendance.manage",
  "submissions.grade",
  "students.view",
  "students.create",
  "batches.update",
  "batches.delete",
  "batches.enroll",
];

module.exports = {
  PERMISSIONS,
  PERMISSION_META,
  ROLE_DEFAULTS,
  TEACHER_MIGRATION_PERMISSIONS,
  normalizePermissions,
};
