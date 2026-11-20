// Global search across assignments, users and submissions.
// Reuses utils/search.js helpers and respects role-based visibility.

const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { buildSearchFilter } = require("../utils/search");
const batchAccessService = require("./batchAccessService");

async function globalSearch({ requester, query }) {
  const q = (query.q || "").trim();
  if (!q || q.length < 2) {
    throw new AppError("Search query must be at least 2 characters.", 400);
  }

  const role = getUserRole(requester);
  const results = { assignments: [], users: [], submissions: [] };

  // Assignments visible to this role.
  if (role === ROLES.ADMIN) {
    const searchFilter = buildSearchFilter(q, ["title", "description"]);
    results.assignments = await Assignment.find({ active: true, ...searchFilter })
      .limit(20)
      .select("title description batch dueDate")
      .lean();
  } else if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const searchFilter = buildSearchFilter(q, ["title", "description"]);
    results.assignments = await Assignment.find({
      active: true,
      batch: { $in: ownedBatchIds },
      ...searchFilter,
    })
      .limit(20)
      .select("title description batch dueDate")
      .lean();
  } else if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    const searchFilter = buildSearchFilter(q, ["title", "description"]);
    results.assignments = await Assignment.find({
      active: true,
      batch: { $in: batchIds },
      ...searchFilter,
    })
      .limit(20)
      .select("title description batch dueDate")
      .lean();
  }

  // Users (admin/teacher only).
  if (role === ROLES.ADMIN || role === ROLES.TEACHER) {
    const userSearch = buildSearchFilter(q, ["name", "email"]);
    const userFilter = { active: true, ...userSearch };
    if (role === ROLES.TEACHER) {
      const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
      const enrollments = await require("../models/Enrollment")
        .find({ batch: { $in: ownedBatchIds }, active: { $ne: false } })
        .select("student")
        .lean();
      const studentIds = enrollments.map((e) => e.student);
      userFilter._id = { $in: studentIds };
    }
    results.users = await User.find(userFilter).limit(20).select("name email role").lean();
  }

  // Submissions visible to this role.
  if (role === ROLES.ADMIN) {
    const subSearch = buildSearchFilter(q, ["fileName"]);
    results.submissions = await Submission.find({ ...subSearch })
      .limit(20)
      .select("assignment student batch status grade")
      .lean();
  } else if (role === ROLES.STUDENT) {
    const subSearch = buildSearchFilter(q, ["fileName"]);
    results.submissions = await Submission.find({ student: getUserId(requester), ...subSearch })
      .limit(20)
      .select("assignment student batch status grade")
      .lean();
  }

  return results;
}

module.exports = { globalSearch };
