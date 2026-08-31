const Role = require("../models/Role");
const {
  PERMISSIONS,
  ROLE_DEFAULTS,
  normalizePermissions,
} = require("../config/permissions");
const { AppError } = require("../utils/errors");
const { assertObjectId } = require("../utils/validation");

const CORE_ROLES = [
  { name: "admin", label: "Administrator" },
  { name: "teacher", label: "Teacher" },
  { name: "student", label: "Student" },
];

const validatePermissions = (permissions) => {
  if (!Array.isArray(permissions))
    throw new AppError("Permissions must be an array.", 400);

  const sanitized = normalizePermissions(permissions);
  const invalid = permissions.filter(
    (permission) => !PERMISSIONS.includes(String(permission).trim()),
  );

  if (invalid.length && sanitized.length === 0)
    throw new AppError("One or more permissions are invalid.", 400, invalid);

  return sanitized;
};

const ensureCoreRoles = () =>
  Promise.all(
    CORE_ROLES.map((role) =>
      Role.findOneAndUpdate(
        { name: role.name },
        {
          $setOnInsert: {
            ...role,
            permissions: ROLE_DEFAULTS[role.name],
            active: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean(),
    ),
  );

exports.listRoles = async (req, res, next) => {
  try {
    const core = await ensureCoreRoles();
    const stored = await Role.find({ active: true }).sort({ name: 1 }).lean();
    const byName = new Map(
      [...core, ...stored].map((role) => [role.name, role]),
    );
    return res.json({
      roles: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
      permissions: PERMISSIONS,
    });
  } catch (error) {
    return next(error);
  }
};

exports.createRole = async (req, res, next) => {
  try {
    const name = String(req.body.name || "")
      .trim()
      .toLowerCase();
    if (!name) throw new AppError("Role name is required.", 400);
    validatePermissions(req.body.permissions || []);
    const role = await Role.create({
      name,
      label: String(req.body.label || name).trim(),
      permissions: req.body.permissions || [],
    });
    return res.status(201).json(role);
  } catch (error) {
    return next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, "role id");
    const update = {};
    if (req.body.label !== undefined) {
      if (!String(req.body.label).trim())
        throw new AppError("Role label cannot be empty.", 400);
      update.label = String(req.body.label).trim();
    }
    if (req.body.permissions !== undefined)
      update.permissions = validatePermissions(req.body.permissions);
    if (req.body.active !== undefined) update.active = Boolean(req.body.active);

    const role = await Role.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!role) throw new AppError("Role not found.", 404);
    return res.json(role);
  } catch (error) {
    return next(error);
  }
};
