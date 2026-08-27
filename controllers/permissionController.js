const User = require('../models/User');
const { PERMISSIONS, ROLE_DEFAULTS } = require('../config/permissions');

exports.catalog = (req, res) => res.json({ permissions: PERMISSIONS, roleDefaults: ROLE_DEFAULTS });
exports.updateUserPermissions = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { permissions: req.body.permissions || [], role: req.body.role }, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(400).json({ error: err.message }); }
};
