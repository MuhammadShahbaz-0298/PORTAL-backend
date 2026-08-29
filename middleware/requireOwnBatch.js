const Submission = require("../models/Submission");
const { AppError } = require("../utils/errors");
const { getUserId, isAdmin } = require("../utils/authorization");

// Teachers may access submissions only when the related batch belongs to them; admins bypass ownership.
const requireOwnBatch = async (req, res, next) => {
  try {
    if (isAdmin(req.user)) return next();

    const submission = await Submission.findById(req.params.id).populate(
      "batch",
    );
    if (!submission) return next(new AppError("Submission not found.", 404));
    if (
      !submission.batch ||
      String(submission.batch.teacher) !== String(getUserId(req.user))
    ) {
      return next(new AppError("You do not have access to this batch.", 403));
    }

    req.submission = submission;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = requireOwnBatch;
