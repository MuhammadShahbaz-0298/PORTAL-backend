// GDPR-style data export and deletion request handling.
// Export compiles a user's records into one JSON bundle.
// Deletion requests are marked, not executed immediately (archive-not-delete pattern).

const User = require("../models/User");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const Enrollment = require("../models/Enrollment");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");

async function exportUserData({ requester, userId }) {
  assertObjectId(userId, "user id");

  const role = getUserRole(requester);
  const requesterId = getUserId(requester);

  // A user may export their own data; admins may export any user's data.
  if (role !== "admin" && requesterId !== userId) {
    throw new AppError("You cannot export another user's data.", 403);
  }

  const user = await User.findById(userId).select("-password").lean();
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const submissions = await Submission.find({ student: userId }).lean();
  const attendance = await Attendance.find({ student: userId }).lean();
  const enrollments = await Enrollment.find({ student: userId }).lean();

  return {
    user,
    submissions,
    attendance,
    enrollments,
    exportedAt: new Date().toISOString(),
  };
}

async function requestDeletion({ requester, userId }) {
  assertObjectId(userId, "user id");

  const role = getUserRole(requester);
  const requesterId = getUserId(requester);

  if (role !== "admin" && requesterId !== userId) {
    throw new AppError("You cannot request deletion for another user.", 403);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  user.active = false;
  user.archivedAt = new Date();
  // Mark for admin-reviewed deletion. Reuses the archive pattern.
  user.deletionRequestedAt = new Date();
  await user.save();

  return { message: "Deletion request recorded. An admin will review it." };
}

module.exports = { exportUserData, requestDeletion };
