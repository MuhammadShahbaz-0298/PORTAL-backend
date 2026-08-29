const User = require("../models/User");
const { PERMISSIONS, ROLE_DEFAULTS } = require("../config/permissions");
const { AppError } = require("../utils/errors");
const { assertObjectId } = require("../utils/validation");

exports.catalog = (req, res) =>
  res.json({ permissions: PERMISSIONS, roleDefaults: ROLE_DEFAULTS });

exports.updateUserPermissions = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, "user id");
    if (!Array.isArray(req.body.permissions))
      throw new AppError("Permissions must be an array.", 400);

    const invalidPermissions = req.body.permissions.filter(
      (permission) => !PERMISSIONS.includes(permission),
    );
    if (invalidPermissions.length)
      throw new AppError(
        "One or more permissions are invalid.",
        400,
        invalidPermissions,
      );

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { permissions: req.body.permissions },
      { new: true, runValidators: true },
    ).select("-password");
    if (!user) throw new AppError("User not found.", 404);
    return res.json(user);
  } catch (error) {
    return next(error);
  }
};
