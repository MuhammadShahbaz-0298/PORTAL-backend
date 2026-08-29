const { AppError } = require('../utils/errors');

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to access this resource.', 403));
  }
  return next();
};

module.exports = requireRole;
