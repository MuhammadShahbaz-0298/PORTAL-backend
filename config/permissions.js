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
  if (!Array.isArray(permissions)) return [];
  const next = new Set();

  for (const permission of permissions) {
    if (typeof permission !== "string") continue;
    const value = permission.trim();
    if (!value) continue;
    if (PERMISSIONS.includes(value)) next.add(value);
  }

  return [...next];
};

const ROLE_DEFAULTS = {
  admin: PERMISSIONS,
  teacher: [
    "dashboard.view",
    "batches.view",
    "assignments.view",
    "assignments.create",
    "assignments.update",
    "assignments.delete",
    "submissions.view",
    "submissions.grade",
    "attendance.view",
    "profile.view",
  ],
  student: [
    "dashboard.view",
    "assignments.view",
    "submissions.view",
    "attendance.view",
    "profile.view",
  ],
};
module.exports = { PERMISSIONS, ROLE_DEFAULTS, normalizePermissions };
