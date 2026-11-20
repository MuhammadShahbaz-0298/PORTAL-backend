// Canonical list of supported permissions and its input normalizer.
// Role defaults and API metadata consume this catalog.

const PERMISSIONS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "batches.view",
  "batches.create",
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
  "users.manage",
  "roles.manage",
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
  "audit.view",
  "search.use",
  "assistant.use",
  "assignments.resources.upload",
  "assignments.resources.view",
  "assignments.resources.download",
  "assignments.resources.delete",
  "attendance.export",
  "submissions.export",
];

const normalizePermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const validPermissions = new Set();
  for (const permission of permissions) {
    if (typeof permission !== "string") {
      continue;
    }

    const value = permission.trim();
    if (value && PERMISSIONS.includes(value)) {
      validPermissions.add(value);
    }
  }

  return [...validPermissions];
};

module.exports = { PERMISSIONS, normalizePermissions };
