const PERMISSIONS = [
  'dashboard.view', 'students.view', 'students.create', 'students.update', 'students.attendance',
  'teachers.view', 'teachers.create', 'teachers.update', 'batches.view', 'batches.create',
  'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete', 'submissions.view', 'submissions.grade',
  'attendance.view', 'attendance.manage', 'users.manage', 'roles.manage', 'profile.view',
];
const ROLE_DEFAULTS = {
  admin: PERMISSIONS,
  teacher: ['dashboard.view', 'batches.view', 'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete', 'submissions.view', 'submissions.grade', 'attendance.view', 'profile.view'],
  student: ['dashboard.view', 'assignments.view', 'submissions.view', 'attendance.view', 'profile.view'],
};
module.exports = { PERMISSIONS, ROLE_DEFAULTS };
