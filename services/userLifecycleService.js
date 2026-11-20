// Password resets and account lifecycle operations.
// Permanent deletion is blocked when historical records depend on the user.

const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");
const { AppError } = require("../utils/errors");
const { assertObjectId } = require("../utils/validation");
const sessionService = require("./sessionService");
const { getUserId } = require("../utils/authorization");
const { generateTemporaryPassword } = require("../utils/temporaryPassword");
const { logSecurityEvent } = require("../utils/securityLog");

async function resetPassword(requester, targetUserId) {
  assertObjectId(targetUserId, "user id");

  if (String(targetUserId) === String(getUserId(requester))) {
    throw new AppError("You cannot reset your own password this way.", 400);
  }

  const user = await User.findById(targetUserId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const temporaryPassword = generateTemporaryPassword();
  user.password = temporaryPassword;
  user.mustChangePassword = true;
  await user.save();

  await sessionService.revokeAllForUser(user._id);
  logSecurityEvent("admin_password_reset", {
    userId: String(user._id),
    triggeredBy: String(getUserId(requester)),
  });

  return temporaryPassword;
}

async function archiveUser({ requester, userId }) {
  assertObjectId(userId, "user id");

  if (String(userId) === String(getUserId(requester))) {
    throw new AppError("You cannot archive your own account.", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  user.active = false;
  user.archivedAt = new Date();
  await user.save();
  await sessionService.revokeAllForUser(user._id);

  return { message: "User archived successfully." };
}

async function deleteUser({ requester, userId }) {
  assertObjectId(userId, "user id");

  if (String(userId) === String(getUserId(requester))) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);

  const references = await Promise.all([
    Enrollment.exists({ student: user._id }),
    Attendance.exists({ $or: [{ student: user._id }, { enteredBy: user._id }] }),
    Submission.exists({ $or: [{ student: user._id }, { gradedBy: user._id }] }),
    Assignment.exists({ createdBy: user._id }),
    Batch.exists({ teacher: user._id }),
  ]);
  if (references.some(Boolean)) {
    throw new AppError(
      "This user has linked history or records. Archive the account instead.",
      409,
    );
  }

  await sessionService.revokeAllForUser(user._id);
  await user.deleteOne();
  return { message: "User deleted permanently." };
}

module.exports = { resetPassword, archiveUser, deleteUser };
