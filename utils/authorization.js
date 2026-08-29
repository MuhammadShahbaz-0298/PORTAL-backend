const { ROLES } = require("../constants");

const getUserId = (user) => user?.userId || user?.id || user?._id;
const getUserRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();
const isAdmin = (user) => getUserRole(user) === ROLES.ADMIN;
const isTeacher = (user) => getUserRole(user) === ROLES.TEACHER;
const isStudent = (user) => getUserRole(user) === ROLES.STUDENT;

module.exports = { getUserId, getUserRole, isAdmin, isTeacher, isStudent };
