const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const { ROLE_DEFAULTS } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const {
  assertEmail,
  assertPassword,
  normalizeEmail,
} = require("../utils/validation");

const signToken = (user) =>
  jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const getEffectivePermissions = async (user) => {
  const storedRole = await Role.findOne({ name: user.role, active: true })
    .select("permissions")
    .lean();
  if (storedRole) return storedRole.permissions || [];
  return user.permissions?.length
    ? user.permissions
    : ROLE_DEFAULTS[user.role] || [];
};

const toSafeUser = async (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  permissions: await getEffectivePermissions(user),
});

const validateRole = async (role) => {
  const roleName = String(role || "")
    .trim()
    .toLowerCase();
  if (
    !ROLE_DEFAULTS[roleName] &&
    !(await Role.exists({ name: roleName, active: true }))
  ) {
    throw new AppError("Role does not exist.", 400);
  }
  return roleName;
};

const registerUser = async ({
  name,
  email,
  password,
  role,
  permissions,
  active = true,
}) => {
  if (!String(name || "").trim()) throw new AppError("Name is required.", 400);
  const normalizedEmail = assertEmail(email);
  assertPassword(password);
  const roleName = await validateRole(role);
  if (await User.exists({ email: normalizedEmail }))
    throw new AppError("Email already in use.", 409);

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password,
    role: roleName,
    permissions: Array.isArray(permissions) ? permissions : [],
    active: Boolean(active),
  });

  return { token: signToken(user), user: await toSafeUser(user) };
};

const loginUser = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password)
    throw new AppError("Email and password are required.", 400);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.active || !(await user.comparePassword(password))) {
    throw new AppError("Invalid credentials or inactive account.", 401);
  }
  return { token: signToken(user), user: await toSafeUser(user) };
};

module.exports = {
  signToken,
  getEffectivePermissions,
  toSafeUser,
  registerUser,
  loginUser,
};
