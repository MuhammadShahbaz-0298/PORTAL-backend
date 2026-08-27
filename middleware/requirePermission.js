const User = require('../models/User');
const { ROLE_DEFAULTS } = require('../config/permissions');
const Role = require('../models/Role');

const requirePermission = (...required) => async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const user = await User.findById(req.user.userId).select('permissions role active');
    const storedRole = await Role.findOne({ name: req.user.role, active: true }).select('permissions').lean();
    const permissions = storedRole ? (storedRole.permissions || []) : (user?.permissions?.length ? user.permissions : (ROLE_DEFAULTS[req.user.role] || []));
    if (!user || !user.active || !required.every((item) => permissions.includes(item))) return res.status(403).json({ error: 'Permission denied' });
    next();
  } catch (err) { next(err); }
};
module.exports = requirePermission;
