// Database work for comments on submissions.
// Only the submission owner, the grading teacher, or an admin may read or write.

const Comment = require("../models/Comment");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin, isTeacher } = require("../utils/authorization");
const { assertObjectId, assertString, pickFields } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");

// Checks that the requester may read or write comments on this submission.
async function assertSubmissionAccess(requester, submissionId) {
  assertObjectId(submissionId, "submission id");

  const submission = await Submission.findById(submissionId).populate("batch", "teacher");

  if (!submission) {
    throw new AppError("Submission not found.", 404);
  }

  const role = getUserRole(requester);
  const userId = getUserId(requester);
  const isOwner = String(submission.student) === userId;

  if (isAdmin(requester)) {
    return submission;
  }

  if (role === ROLES.STUDENT && isOwner) {
    return submission;
  }

  if (role === ROLES.TEACHER && isTeacher(requester)) {
    const ownsBatch = submission.batch && String(submission.batch.teacher) === userId;
    if (ownsBatch) {
      return submission;
    }
  }

  throw new AppError("You do not have access to this submission.", 403);
}

async function listComments({ requester, submissionId, query }) {
  await assertSubmissionAccess(requester, submissionId);
  const pagination = getPagination(query);
  const total = await Comment.countDocuments({ submission: submissionId, active: true });
  const items = await Comment.find({ submission: submissionId, active: true })
    .populate("author", "name email role")
    .sort({ createdAt: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

async function createComment({ requester, submissionId, payload }) {
  await assertSubmissionAccess(requester, submissionId);
  const fields = pickFields(payload, ["text"]);
  const text = assertString(fields.text, "text", { maxLength: 2000 });

  const comment = await Comment.create({
    submission: submissionId,
    author: getUserId(requester),
    text,
  });

  return comment.populate("author", "name email role");
}

async function archiveComment({ requester, commentId }) {
  assertObjectId(commentId, "comment id");
  const comment = await Comment.findById(commentId).populate("submission");

  if (!comment || !comment.active) {
    throw new AppError("Comment not found.", 404);
  }

  const isAuthor = String(comment.author) === getUserId(requester);

  if (!isAdmin(requester) && !isAuthor) {
    throw new AppError("You do not own this comment.", 403);
  }

  // If the user is the author but not admin, also require submission access.
  if (!isAdmin(requester)) {
    await assertSubmissionAccess(requester, comment.submission._id);
  }

  comment.active = false;
  comment.archivedAt = new Date();
  await comment.save();

  return { message: "Comment archived successfully." };
}

module.exports = {
  listComments,
  createComment,
  archiveComment,
  assertSubmissionAccess,
};
