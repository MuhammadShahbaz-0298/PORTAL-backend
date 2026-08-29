const ROLES = Object.freeze({
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
});
const ROLE_NAMES = Object.freeze(Object.values(ROLES));
const ATTENDANCE_STATUSES = Object.freeze(["present", "absent", "leave"]);
const SUBMISSION_STATUSES = Object.freeze(["submitted", "graded", "rejected"]);
const DEFAULT_PAGE_SIZE = 50;

module.exports = {
  ROLES,
  ROLE_NAMES,
  ATTENDANCE_STATUSES,
  SUBMISSION_STATUSES,
  DEFAULT_PAGE_SIZE,
};
