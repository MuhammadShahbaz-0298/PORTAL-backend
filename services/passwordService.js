// Changing your own password.
// Other sessions are revoked; the session that made the change stays valid.

const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { assertPassword } = require("../utils/validation");
const sessionService = require("./sessionService");
const { logSecurityEvent } = require("../utils/securityLog");

async function changePassword({ userId, currentPassword, newPassword, currentSessionId }) {
  if (typeof currentPassword !== "string") {
    throw new AppError("Current password is required.", 400);
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError("Current password is incorrect.", 401);
  }

  assertPassword(newPassword);
  user.password = newPassword;
  await user.save();
  await sessionService.revokeOtherSessions(userId, currentSessionId);
  logSecurityEvent("password_changed", { userId: String(user._id) });
}

module.exports = { changePassword };
