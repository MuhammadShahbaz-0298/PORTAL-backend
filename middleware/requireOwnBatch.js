// Only a teacher who owns the submission's batch, or an admin, may grade it.
// Admins bypass ownership. Everyone else is checked against the database.

const mongoose = require("mongoose");
const Submission = require("../models/Submission");
const { AppError } = require("../utils/errors");
const asyncHandler = require("../utils/asyncHandler");
const { getUserId, isAdmin, isTeacher } = require("../utils/authorization");

const requireOwnSubmission = asyncHandler(async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new AppError("Invalid submission id.", 400);
  }

  const submission = await Submission.findById(request.params.id).populate("batch", "teacher");

  if (!submission) {
    throw new AppError("Submission not found.", 404);
  }

  if (isAdmin(request.user)) {
    request.submission = submission;
    return next();
  }

  if (
    isTeacher(request.user) &&
    submission.batch &&
    String(submission.batch.teacher) === String(getUserId(request.user))
  ) {
    request.submission = submission;
    return next();
  }

  throw new AppError("You do not have access to this submission.", 403);
});

module.exports = requireOwnSubmission;
