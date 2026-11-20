// Read submissions, downloadable files and prior versions.
// Access is limited to the owning student, batch teacher or an administrator.

const fs = require("fs");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const { assertObjectId, assertOptionalString } = require("../utils/validation");
const { resolveUploadPath, sanitizeDisplayFileName } = require("../utils/files");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

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
  const itemsQuery = Submission.find(filter)
    .populate("assignment", "title dueDate")
    .populate("student", "name email")
    .populate("batch", "name")
    .sort({ submittedAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);
  if (role === ROLES.STUDENT) {
    itemsQuery.select("-aiDraft");
  }

  const items = await itemsQuery;
  return { items, pagination, total };
}

async function getAuthorizedSubmission(requester, submissionId) {
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
  return submission;
}

async function getSubmissionForDownload({ requester, submissionId }) {
  const submission = await getAuthorizedSubmission(requester, submissionId);
  const filePath = resolveUploadPath(submission.filePath);
  if (!fs.existsSync(filePath)) {
    throw new AppError("Submission file is no longer available.", 404);
  }

  return {
    filePath,
    downloadName: sanitizeDisplayFileName(submission.fileName),
  };
}

async function getSubmissionVersions({ requester, submissionId }) {
  const submission = await getAuthorizedSubmission(requester, submissionId);
  return submission.versions || [];
}

module.exports = { listSubmissions, getSubmissionForDownload, getSubmissionVersions };
