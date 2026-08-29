const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const {
  assertEmail,
  assertObjectId,
  assertPassword,
  normalizeEmail,
} = require("../utils/validation");

exports.listUsers = async (req, res, next) => {
  try {
    const filter = req.query.role
      ? { role: String(req.query.role).trim().toLowerCase() }
      : {};
    const users = await User.find(filter).select("-password").sort({ name: 1 });
    return res.json(users);
  } catch (error) {
    return next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, "user id");
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError("User not found.", 404);

    const { name, email, role, password, active, permissions, batchId } =
      req.body;
    if (name !== undefined) {
      if (!String(name).trim())
        throw new AppError("Name cannot be empty.", 400);
      user.name = String(name).trim();
    }
    if (email !== undefined) user.email = assertEmail(email);
    if (role !== undefined) user.role = String(role).trim().toLowerCase();
    if (password) {
      assertPassword(password);
      user.password = password;
    }
    if (active !== undefined) user.active = Boolean(active);
    if (permissions !== undefined) {
      if (!Array.isArray(permissions))
        throw new AppError("Permissions must be an array.", 400);
      user.permissions = permissions;
    }

    await user.save();
    if (batchId && user.role === "student") {
      assertObjectId(batchId, "batch id");
      await Enrollment.findOneAndUpdate(
        { student: user._id, batch: batchId },
        { student: user._id, batch: batchId },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    return res.json(user.toSafeJSON());
  } catch (error) {
    return next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, "user id");
    if (String(req.params.id) === String(getUserId(req.user)))
      throw new AppError("You cannot deactivate your own account.", 400);
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true },
    ).select("-password");
    if (!user) throw new AppError("User not found.", 404);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};
