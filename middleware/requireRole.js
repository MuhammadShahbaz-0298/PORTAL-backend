// Simple role check for the few routes where a role is clearer than a permission.
// It uses the current role loaded by the auth middleware.

const { AppError } = require("../utils/errors");

const requireRole =
  (...allowedRoles) =>
  (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return next(new AppError("You do not have permission to access this resource.", 403));
    }

    return next();
  };

module.exports = requireRole;
