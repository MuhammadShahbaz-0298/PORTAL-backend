// Reading, grading and downloading submissions.
// Upload and replacement rules live in submissionUploadService.js.

const fs = require("fs");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const { assertGrade, assertObjectId, assertOptionalString } = require("../utils/validation");
const { resolveUploadPath, sanitizeDisplayFileName } = require("../utils/files");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const uploadService = require("./submissionUploadService");

async function listSubmissions({ requester, query }) {
  const pagination = getPagination(query);
  const filters = [];
  const role = getUserRole(requester);
  const assignmentId = assertOptionalString(query.assignmentId, "assignmentId", {
    maxLength: 50,
  });

  if (assignmentId) {
    filters.push({ assignment: assertObjectId(assignmentId, "assignmentId") });
  }

  if (role === ROLES.STUDENT) {
    filters.push({ student: getUserId(requester) });
  }

  if (role === ROLES.TEACHER) {
    const batchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: batchIds } });
  }

  if (![ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT].includes(role)) {
    filters.push({ _id: null });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await Submission.countDocuments(filter);
  const items = await Submission.find(filter)
    .populate("assignment", "title dueDate")
    .populate("student", "name email")
    .populate("batch", "name")
    .sort({ submittedAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

async function gradeSubmission({ requester, submission, payload }) {
  const grade = assertGrade(payload.grade);
  const feedback = assertOptionalString(payload.feedback, "feedback", {
    allowEmpty: true,
    maxLength: 2000,
  });
  const nextStatus = payload.status === "rejected" ? "rejected" : "graded";

  submission.grade = grade;
  submission.feedback = feedback || null;
  submission.status = nextStatus;
  submission.gradedBy = getUserId(requester);
  submission.gradedAt = new Date();
  await submission.save();

  return submission;
}

async function getSubmissionForDownload({ requester, submissionId }) {
  assertObjectId(submissionId, "submission id");
  const submission = await Submission.findById(submissionId).populate("batch", "teacher");

  if (!submission) {
    throw new AppError("Submission not found.", 404);
  }

  const role = getUserRole(requester);
  const isOwner = String(submission.student) === getUserId(requester);
  const ownsBatch = submission.batch && String(submission.batch.teacher) === getUserId(requester);
  const allowed =
    isAdmin(requester) ||
    (role === ROLES.STUDENT && isOwner) ||
    (role === ROLES.TEACHER && ownsBatch);

  if (!allowed) {
    throw new AppError("Not authorized to access this file.", 403);
  }

  const filePath = resolveUploadPath(submission.filePath);
  if (!fs.existsSync(filePath)) {
    throw new AppError("Submission file is no longer available.", 404);
  }

  return {
    filePath,
    downloadName: sanitizeDisplayFileName(submission.fileName),
  };
}

module.exports = {
  ...uploadService,
  listSubmissions,
  gradeSubmission,
  getSubmissionForDownload,
};
