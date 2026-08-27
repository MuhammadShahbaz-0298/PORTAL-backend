const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

exports.listUsers = async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).select('-password').sort({ name: 1 });
  res.json(users);
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, email, role, password, active, permissions, batchId } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (password) user.password = password;
    if (active !== undefined) user.active = active;
    if (permissions !== undefined) user.permissions = permissions;
    await user.save();
    if (batchId && user.role === 'student') await Enrollment.findOneAndUpdate({ student: user._id, batch: batchId }, { student: user._id, batch: batchId }, { upsert: true, new: true });
    res.json(user.toSafeJSON());
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
};
