// Database work for roles.
// The three core roles are created on first use, so a fresh database is usable.

const Role = require("../models/Role");
const { ROLES, ROLE_NAME_MAX_LENGTH } = require("../constants");
const { PERMISSIONS, ROLE_DEFAULTS } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const {
  assertArrayOfStrings,
  assertBoolean,
  assertObjectId,
  assertString,
} = require("../utils/validation");

const CORE_ROLES = [
  { name: ROLES.ADMIN, label: "Administrator" },
  { name: ROLES.TEACHER, label: "Teacher" },
  { name: ROLES.STUDENT, label: "Student" },
];

function validatePermissions(permissions) {
  return assertArrayOfStrings(permissions, "permissions", {
    allowedValues: PERMISSIONS,
    maxItems: 100,
  });
}

async function ensureCoreRoles() {
  for (const role of CORE_ROLES) {
    await Role.findOneAndUpdate(
      { name: role.name },
      {
        $setOnInsert: {
          ...role,
          permissions: ROLE_DEFAULTS[role.name],
          active: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function listRoles() {
  await ensureCoreRoles();
  const roles = await Role.find({ active: true }).sort({ name: 1 }).lean();
  return { roles, permissions: PERMISSIONS };
}

async function createRole({ payload }) {
  const name = assertString(payload.name, "name", {
    maxLength: ROLE_NAME_MAX_LENGTH,
  }).toLowerCase();
  const label = assertString(payload.label || name, "label", { maxLength: 100 });
  const permissions = validatePermissions(payload.permissions || []);

  if (await Role.exists({ name })) {
    throw new AppError("A role with that name already exists.", 409);
  }

  return Role.create({ name, label, permissions });
}

async function updateRole({ roleId, payload }) {
  assertObjectId(roleId, "role id");
  const role = await Role.findById(roleId);

  if (!role) {
    throw new AppError("Role not found.", 404);
  }

  if (payload.label !== undefined) {
    role.label = assertString(payload.label, "label", { maxLength: 100 });
  }

  if (payload.permissions !== undefined) {
    role.permissions = validatePermissions(payload.permissions);
  }

  if (payload.active !== undefined) {
    if (CORE_ROLES.some((coreRole) => coreRole.name === role.name) && payload.active === false) {
      throw new AppError("Core roles cannot be disabled.", 400);
    }
    role.active = assertBoolean(payload.active, "active");
  }

  await role.save();
  return role;
}

module.exports = { ensureCoreRoles, listRoles, createRole, updateRole };
