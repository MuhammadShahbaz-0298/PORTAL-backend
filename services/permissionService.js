// Works out what a user may do right now.
// Role permissions come from MongoDB on every request, so demotions apply immediately.

const Role = require("../models/Role");
const User = require("../models/User");
const { ROLE_DEFAULTS, normalizePermissions, PERMISSIONS } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const { assertArrayOfStrings, assertObjectId } = require("../utils/validation");

async function getEffectivePermissions(user) {
  const role = await Role.findOne({ name: user.role, active: true }).select("permissions").lean();

  if (role) {
    const rolePermissions = role.permissions || [];
    const userPermissions = user.permissions || [];
    return normalizePermissions([...rolePermissions, ...userPermissions]);
  }

  if (user.permissions?.length) {
    return normalizePermissions(user.permissions);
  }

  return normalizePermissions(ROLE_DEFAULTS[user.role] || []);
}

async function updateUserPermissions({ userId, permissions }) {
  assertObjectId(userId, "user id");

  if (!Array.isArray(permissions)) {
    throw new AppError("Permissions must be an array.", 400);
  }

  const cleanedPermissions = assertArrayOfStrings(permissions, "permissions", {
    allowedValues: PERMISSIONS,
    maxItems: 100,
  });
  const user = await User.findByIdAndUpdate(
    userId,
    { permissions: cleanedPermissions },
    { new: true, runValidators: true },
  ).select("-password");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
}

module.exports = { getEffectivePermissions, updateUserPermissions };
