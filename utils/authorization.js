// Small helpers that decide who the request user is.
// Always read the role from the fresh database user, never from the token.

const { ROLES } = require("../constants");

const getUserId = (user) => {
  const value = user?.userId || user?.id || user?._id;
  return value ? String(value) : "";
};

const getUserRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();

const isAdmin = (user) => getUserRole(user) === ROLES.ADMIN;
const isTeacher = (user) => getUserRole(user) === ROLES.TEACHER;
const isStudent = (user) => getUserRole(user) === ROLES.STUDENT;

module.exports = { getUserId, getUserRole, isAdmin, isTeacher, isStudent };
