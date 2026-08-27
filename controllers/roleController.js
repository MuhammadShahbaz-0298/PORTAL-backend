const Role = require('../models/Role');
const { PERMISSIONS, ROLE_DEFAULTS } = require('../config/permissions');
const CORE_ROLES = [
  { name: 'admin', label: 'Administrator' },
  { name: 'teacher', label: 'Teacher' },
  { name: 'student', label: 'Student' },
];
const ensureCoreRoles = () => Promise.all(CORE_ROLES.map((role) => Role.findOneAndUpdate(
  { name: role.name },
  { $setOnInsert: { ...role, permissions: ROLE_DEFAULTS[role.name], active: true } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
).lean()));
exports.listRoles = async (req, res) => {
  const core = await ensureCoreRoles();
  const stored = await Role.find({ active: true }).sort({ name: 1 }).lean();
  const byName = new Map([...core, ...stored].map((role) => [role.name, role]));
  res.json({ roles: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), permissions: PERMISSIONS });
};
exports.createRole = async (req, res) => {
  try { const name = String(req.body.name || '').trim().toLowerCase(); if (!name) return res.status(400).json({ error: 'Role name is required' }); const role = await Role.create({ name, label: req.body.label || name, permissions: req.body.permissions || [] }); res.status(201).json(role) } catch (err) { res.status(400).json({ error: err.message }) }
};
exports.updateRole = async (req, res) => {
  try { const role = await Role.findByIdAndUpdate(req.params.id, { label: req.body.label, permissions: req.body.permissions, active: req.body.active }, { new: true, runValidators: true }); if (!role) return res.status(404).json({ error: 'Role not found' }); res.json(role) } catch (err) { res.status(400).json({ error: err.message }) }
};
