// Checks permissions that the auth middleware already loaded fresh from MongoDB.
// This file never reads the role or permissions from the token.

const { AppError } = require("../utils/errors");

const requirePermission =
  (...requiredPermissions) =>
  (request, response, next) => {
    const currentPermissions = request.user?.permissions || [];
    const hasEveryPermission = requiredPermissions.every((permission) =>
      currentPermissions.includes(permission),
    );

    if (!hasEveryPermission) {
      return next(new AppError("You do not have the required permission.", 403));
    }

    return next();
  };

module.exports = requirePermission;
