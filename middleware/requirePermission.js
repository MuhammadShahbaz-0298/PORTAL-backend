const User = require("../models/User");
const Role = require("../models/Role");
const { ROLE_DEFAULTS } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");

const resolvePermissions = async (user) => {
  const role = await Role.findOne({ name: user.role, active: true })
    .select("permissions")
    .lean();
  return (
    role?.permissions ||
    (user.permissions?.length
      ? user.permissions
      : ROLE_DEFAULTS[user.role] || [])
  );
};

const requirePermission =
  (...requiredPermissions) =>
  async (req, res, next) => {
    try {
      const user = await User.findById(getUserId(req.user)).select(
        "permissions role active",
      );
      if (!user || !user.active)
        return next(new AppError("Active user account is required.", 403));

      const permissions = await resolvePermissions(user);
      if (
        !requiredPermissions.every((permission) =>
          permissions.includes(permission),
        )
      ) {
        return next(
          new AppError("You do not have the required permission.", 403),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

module.exports = requirePermission;
