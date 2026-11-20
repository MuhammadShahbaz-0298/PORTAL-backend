// Database work for users.
// Deletes are soft: the account is disabled and archived, never removed.

const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { ROLES } = require("../constants");
const batchAccessService = require("./batchAccessService");
const userLifecycleService = require("./userLifecycleService");
const userUpdateService = require("./userUpdateService");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertOptionalString } = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");

async function listUsers({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["name", "email"]);
  const roleFilter = assertOptionalString(query.role, "role", { maxLength: 50 });
  const filters = [searchFilter];

  if (roleFilter) {
    filters.push({ role: roleFilter.toLowerCase() });
  }

  if (getUserRole(requester) === ROLES.TEACHER) {
    const batchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const enrollments = await Enrollment.find({
      batch: { $in: batchIds },
      active: { $ne: false },
    })
      .select("student")
      .lean();
    const studentIds = enrollments.map((enrollment) => enrollment.student);

    filters.push({ _id: { $in: studentIds } });
    filters.push({ role: ROLES.STUDENT });
    filters.push({ active: true });
  }

  const filter = filters.length === 1 ? filters[0] : { $and: filters };
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("-password")
    .sort({ name: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items: users, pagination, total };
}

module.exports = {
  listUsers,
  ...userUpdateService,
  ...userLifecycleService,
};
