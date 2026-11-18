// Reading, grading and downloading submissions.
// Upload and replacement rules live in submissionUploadService.js.

const fs = require("fs");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const {
  assertGrade,
  assertObjectId,
  assertOptionalString,
  assertString,
  assertNumber,
} = require("../utils/validation");
const { resolveUploadPath, sanitizeDisplayFileName } = require("../utils/files");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

// Pure function: computes a late penalty from a policy and two dates.
// Returns the penalty percentage (0-100). Never hardcodes a percentage.
function computeLatePenalty(latePolicy, submittedAt, dueDate) {
  if (!latePolicy || latePolicy.type === "none") {
    return 0;
  }

  const submittedDate = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  const dueDateValue = dueDate instanceof Date ? dueDate : new Date(dueDate);

  if (submittedDate <= dueDateValue) {
    return 0;
  }

  const graceDays = latePolicy.graceDays || 0;
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.ceil(
    (submittedDate.getTime() - dueDateValue.getTime()) / millisecondsPerDay,
  );

  if (daysLate <= graceDays) {
    return 0;
  }

  const effectiveDaysLate = daysLate - graceDays;

  if (latePolicy.type === "flat") {
    return latePolicy.flatAmount || 0;
  }

  if (latePolicy.type === "percentagePerDay") {
    const percentage = (latePolicy.percentage || 0) * effectiveDaysLate;
    return Math.min(100, percentage);
  }

  return 0;
}
const uploadService = require("./submissionUploadService");
const guardianService = require("./guardianService");

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

  if (role === "guardian") {
    const childBatchIds = await guardianService.getGuardianBatchIds(getUserId(requester));
    filters.push({ batch: { $in: childBatchIds } });
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

  // Students must never receive AI draft data, even if a field is added later.
  if (role === ROLES.STUDENT) {
    itemsQuery.select("-aiDraft");
  }

  const items = await itemsQuery;

  return { items, pagination, total };
}

async function gradeSubmission({ requester, submission, payload }) {
  const grade = assertGrade(payload.grade);
  const feedback = assertOptionalString(payload.feedback, "feedback", {
    allowEmpty: true,
    maxLength: 2000,
  });
  const nextStatus = payload.status === "rejected" ? "rejected" : "graded";
  const savedFeedback = feedback || null;

  // Optional structured rubric scores. Validate against the assignment's max per criterion.
  if (payload.rubricScores !== undefined) {
    const scores = Array.isArray(payload.rubricScores) ? payload.rubricScores : [];
    const assignment = await Assignment.findById(submission.assignment).select("rubricItems");
    const maxByCriterion = new Map(
      (assignment?.rubricItems || []).map((item) => [item.criterion, item.maxPoints]),
    );

    const cleanedScores = [];
    for (const score of scores) {
      if (!score || typeof score !== "object") {
        throw new AppError("Invalid rubric score entry.", 400);
      }
      const criterion = assertString(score.criterion, "criterion", { maxLength: 200 });
      const points = assertNumber(score.points, "points", { min: 0 });
      const maxPoints = maxByCriterion.get(criterion);
      if (maxPoints === undefined) {
        throw new AppError(`Unknown rubric criterion: ${criterion}.`, 400);
      }
      if (points > maxPoints) {
        throw new AppError(`Score for ${criterion} exceeds maximum of ${maxPoints}.`, 400);
      }
      cleanedScores.push({ criterion, points });
    }
    submission.rubricScores = cleanedScores;
  }

  submission.grade = grade;
  submission.feedback = savedFeedback;
  submission.status = nextStatus;
  submission.gradedBy = getUserId(requester);
  submission.gradedAt = new Date();

  // Record whether the teacher used the AI draft as-is or changed it.
  if (submission.aiDraft && submission.aiDraft.status === "ready") {
    submission.aiDraft.status = savedFeedback === submission.aiDraft.feedback ? "used" : "edited";
  }

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

async function getSubmissionVersions({ requester, submissionId }) {
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

  return submission.versions || [];
}

module.exports = {
  ...uploadService,
  listSubmissions,
  gradeSubmission,
  getSubmissionForDownload,
  getSubmissionVersions,
  computeLatePenalty,
};
