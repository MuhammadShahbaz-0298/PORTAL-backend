// The one list of permissions and the default permissions for each core role.
// Custom roles are stored in MongoDB, but these defaults are the starting point.

const PERMISSIONS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "students.update",
  "students.attendance",
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
  "users.manage",
  "roles.manage",
  "profile.view",
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
    if (!value) {
      continue;
    }

    if (PERMISSIONS.includes(value)) {
      validPermissions.add(value);
    }
  }

  return [...validPermissions];
};

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
  "profile.view",
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
  ROLE_DEFAULTS,
  TEACHER_MIGRATION_PERMISSIONS,
  normalizePermissions,
};
