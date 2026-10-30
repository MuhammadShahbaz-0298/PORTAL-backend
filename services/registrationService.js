// Account creation and the safe user shape returned to clients.
// Teachers may create students only; admins may grant extra permissions.

const User = require("../models/User");
const Role = require("../models/Role");
const { ROLE_DEFAULTS, normalizePermissions } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const { ROLES, NAME_MAX_LENGTH, ROLE_NAME_MAX_LENGTH } = require("../constants");
const {
  assertArrayOfStrings,
  assertBoolean,
  assertEmail,
  assertPassword,
  assertString,
  pickFields,
} = require("../utils/validation");
const { getEffectivePermissions } = require("./permissionService");

async function toSafeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    permissions: await getEffectivePermissions(user),
  };
}

async function validateRole(role) {
  const roleName = assertString(role, "role", { maxLength: ROLE_NAME_MAX_LENGTH }).toLowerCase();
  const roleExists = await Role.exists({ name: roleName, active: true });

  if (!ROLE_DEFAULTS[roleName] && !roleExists) {
    throw new AppError("Role does not exist.", 400);
  }

  return roleName;
}

async function registerUser({ actor, payload }) {
  const allowedFields = ["name", "email", "password", "role", "permissions", "active"];
  const fields = pickFields(payload, allowedFields);
  const name = assertString(fields.name, "name", { maxLength: NAME_MAX_LENGTH });
  const email = assertEmail(fields.email);
  const password = assertPassword(fields.password);
  const actorRole = String(actor.role || "").toLowerCase();
  const role = await validateRole(fields.role);

  // Teachers may only create students, and may not grant extra permissions.
  if (actorRole !== ROLES.ADMIN && role !== ROLES.STUDENT) {
    throw new AppError("Teachers may only create student accounts.", 403);
  }

  let permissions = [];
  if (actorRole === ROLES.ADMIN && fields.permissions !== undefined) {
    const requestedPermissions = assertArrayOfStrings(fields.permissions, "permissions", {
      maxItems: 100,
    });
    permissions = normalizePermissions(requestedPermissions);
  }

  let active = true;
  if (actorRole === ROLES.ADMIN && fields.active !== undefined) {
    active = assertBoolean(fields.active, "active");
  }

  if (await User.exists({ email })) {
    throw new AppError("Email already in use.", 409);
  }

  const user = await User.create({ name, email, password, role, permissions, active });

  return toSafeUser(user);
}

module.exports = { registerUser, toSafeUser, validateRole };
