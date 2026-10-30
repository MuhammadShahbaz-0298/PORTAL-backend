// Database work for users.
// Deletes are soft: the account is disabled and archived, never removed.

const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { ROLES, NAME_MAX_LENGTH } = require("../constants");
const { AppError } = require("../utils/errors");
const { normalizePermissions } = require("../config/permissions");
const { validateRole } = require("./registrationService");
const sessionService = require("./sessionService");
const batchAccessService = require("./batchAccessService");
const { getUserId, getUserRole } = require("../utils/authorization");
const {
  assertBoolean,
  assertEmail,
  assertObjectId,
  assertOptionalString,
  assertPassword,
  assertString,
  pickFields,
} = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const { generateTemporaryPassword } = require("../utils/temporaryPassword");
const { logSecurityEvent } = require("../utils/securityLog");

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
    const enrollments = await Enrollment.find({ batch: { $in: batchIds } })
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

async function updateUser({ requester, userId, payload }) {
  assertObjectId(userId, "user id");
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const fields = pickFields(payload, [
    "name",
    "email",
    "role",
    "password",
    "active",
    "permissions",
  ]);
  const isSelf = String(user._id) === String(getUserId(requester));
  let shouldRevokeSessions = false;

  if (fields.name !== undefined) {
    user.name = assertString(fields.name, "name", { maxLength: NAME_MAX_LENGTH });
  }

  if (fields.email !== undefined) {
    user.email = assertEmail(fields.email);
  }

  if (fields.role !== undefined) {
    const nextRole = await validateRole(fields.role);

    if (isSelf && nextRole !== user.role) {
      throw new AppError("You cannot change your own role.", 400);
    }

    shouldRevokeSessions = shouldRevokeSessions || nextRole !== user.role;
    user.role = nextRole;
  }

  if (fields.password !== undefined) {
    user.password = assertPassword(fields.password);
    shouldRevokeSessions = true;
  }

  if (fields.active !== undefined) {
    const nextActive = assertBoolean(fields.active, "active");

    if (isSelf && !nextActive) {
      throw new AppError("You cannot disable your own account.", 400);
    }

    shouldRevokeSessions = shouldRevokeSessions || nextActive !== user.active;
    user.active = nextActive;
    user.archivedAt = nextActive ? null : new Date();
  }

  if (fields.permissions !== undefined) {
    if (!Array.isArray(fields.permissions)) {
      throw new AppError("Permissions must be an array.", 400);
    }
    user.permissions = normalizePermissions(fields.permissions);
  }

  await user.save();

  if (shouldRevokeSessions) {
    await sessionService.revokeAllForUser(user._id);
  }

  return user.toSafeJSON();
}

async function resetPassword(requester, targetUserId) {
  assertObjectId(targetUserId, "user id");

  if (String(targetUserId) === String(getUserId(requester))) {
    throw new AppError("You cannot reset your own password this way.", 400);
  }

  const user = await User.findById(targetUserId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const temporaryPassword = generateTemporaryPassword();

  // The User model's pre-save hook hashes this before it reaches MongoDB.
  user.password = temporaryPassword;
  user.mustChangePassword = true;
  await user.save();

  await sessionService.revokeAllForUser(user._id);
  logSecurityEvent("admin_password_reset", {
    userId: String(user._id),
    triggeredBy: String(getUserId(requester)),
  });

  return temporaryPassword;
}

async function deleteUser({ requester, userId }) {
  assertObjectId(userId, "user id");

  if (String(userId) === String(getUserId(requester))) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  user.active = false;
  user.archivedAt = new Date();
  await user.save();
  await sessionService.revokeAllForUser(user._id);

  return { message: "User archived successfully." };
}

module.exports = { listUsers, updateUser, resetPassword, deleteUser };
