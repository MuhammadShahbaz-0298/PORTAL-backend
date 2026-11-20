// Update a user's profile, role, password or account settings.
// Role, password and active-state changes revoke existing sessions.

const User = require("../models/User");
const { NAME_MAX_LENGTH } = require("../constants");
const { AppError } = require("../utils/errors");
const { normalizePermissions } = require("../config/permissions");
const { validateRole } = require("./registrationService");
const sessionService = require("./sessionService");
const { getUserId } = require("../utils/authorization");
const {
  assertBoolean,
  assertEmail,
  assertObjectId,
  assertPassword,
  assertString,
  pickFields,
} = require("../utils/validation");

function applyNameAndEmail(user, fields) {
  if (fields.name !== undefined) {
    user.name = assertString(fields.name, "name", { maxLength: NAME_MAX_LENGTH });
  }
  if (fields.email !== undefined) {
    user.email = assertEmail(fields.email);
  }
}

async function applyRoleChange(user, fields, isSelf, changes) {
  if (fields.role === undefined) {
    return;
  }

  const nextRole = await validateRole(fields.role);
  if (isSelf && nextRole !== user.role) {
    throw new AppError("You cannot change your own role.", 400);
  }
  if (nextRole !== user.role) {
    changes.revokeSessions = true;
  }
  user.role = nextRole;
}

function applyPasswordChange(user, fields, changes) {
  if (fields.password === undefined) {
    return;
  }
  user.password = assertPassword(fields.password);
  changes.revokeSessions = true;
}

function applyStatusAndPermissions(user, fields, isSelf, changes) {
  if (fields.active !== undefined) {
    const nextActive = assertBoolean(fields.active, "active");
    if (isSelf && !nextActive) {
      throw new AppError("You cannot disable your own account.", 400);
    }
    if (nextActive !== user.active) {
      changes.revokeSessions = true;
    }
    user.active = nextActive;
    if (nextActive) user.archivedAt = null;
  }

  if (fields.permissions !== undefined) {
    if (!Array.isArray(fields.permissions)) {
      throw new AppError("Permissions must be an array.", 400);
    }
    user.permissions = normalizePermissions(fields.permissions);
  }
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
  const changes = { revokeSessions: false };

  applyNameAndEmail(user, fields);
  await applyRoleChange(user, fields, isSelf, changes);
  applyPasswordChange(user, fields, changes);
  applyStatusAndPermissions(user, fields, isSelf, changes);
  await user.save();

  if (changes.revokeSessions) {
    await sessionService.revokeAllForUser(user._id);
  }
  return user.toSafeJSON();
}

module.exports = { updateUser };
