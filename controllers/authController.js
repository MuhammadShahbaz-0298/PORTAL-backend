const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const {
  getEffectivePermissions,
  loginUser,
  registerUser,
  toSafeUser,
} = require("../services/authService");

exports.register = async (req, res, next) => {
  try {
    const { batchId, ...userDetails } = req.body;
    const result = await registerUser(userDetails);

    if (batchId && result.user.role === "student") {
      await Enrollment.create({ student: result.user.id, batch: batchId });
    }

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    return res.json(await loginUser(req.body));
  } catch (error) {
    return next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user || !user.active)
      return next(new AppError("Account inactive.", 401));
    return res.json({
      ...user.toObject(),
      permissions: await getEffectivePermissions(user),
    });
  } catch (error) {
    return next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return next(new AppError("Current and new passwords are required.", 400));

    const user = await User.findById(req.user.userId);
    if (!user) return next(new AppError("User not found.", 404));
    if (!(await user.comparePassword(currentPassword)))
      return next(new AppError("Current password is incorrect.", 401));

    user.password = newPassword;
    await user.save();
    return res.json({ message: "Password updated." });
  } catch (error) {
    return next(error);
  }
};

module.exports = exports;
