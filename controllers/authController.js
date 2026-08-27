const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { ROLE_DEFAULTS } = require('../config/permissions');
const Role = require('../models/Role');

const signToken = (user) => jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const getEffectivePermissions = async (user) => {
  const storedRole = await Role.findOne({ name: user.role, active: true }).select('permissions').lean();
  if (storedRole) return storedRole.permissions || [];
  return user.permissions?.length ? user.permissions : (ROLE_DEFAULTS[user.role] || []);
};
const safeUser = async (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, active: user.active, permissions: await getEffectivePermissions(user) });

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, permissions, active = true, batchId } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, and role are required' });
    const roleName = String(role).trim().toLowerCase();
    if (!ROLE_DEFAULTS[roleName] && !(await Role.exists({ name: roleName, active: true }))) return res.status(400).json({ error: 'Role does not exist' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'Email already in use' });
    const user = await User.create({ name, email, password, role: roleName, permissions, active });
    if (batchId && roleName === 'student') await Enrollment.create({ student: user._id, batch: batchId });
    res.status(201).json({ token: signToken(user), user: await safeUser(user) });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !user.active || !(await user.comparePassword(req.body.password))) return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    res.json({ token: signToken(user), user: await safeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  if (!user || !user.active) return res.status(401).json({ error: 'Account inactive' });
  res.json({ ...user.toObject(), permissions: await getEffectivePermissions(user) });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const user = await User.findById(req.user.userId);
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = newPassword; await user.save(); res.json({ message: 'Password updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
