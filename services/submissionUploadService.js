// Upload and replacement rules for submissions.
// One student has at most one submission per assignment; re-upload replaces it.

const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { MAX_SUBMISSIONS_PER_ASSIGNMENT } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const { removeFile, sanitizeDisplayFileName } = require("../utils/files");
const batchAccessService = require("./batchAccessService");
const assignmentService = require("./assignmentService");
const aiDraftService = require("./aiDraftService");
const {
  validateUploadedFile,
  assertCanReplace,
  applyReplacementFile,
  saveReplacementSnapshot,
} = require("./submissionUploadValidation");
const { checkSimilarity } = require("./submissionSimilarityService");
const { createLinkSubmission } = require("./submissionLinkService");

async function createSubmission({ requester, assignmentId, file }) {
  assertObjectId(assignmentId, "assignmentId");
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    throw new AppError("Assignment not found.", 404);
  }

  if (!assignment.active || assignmentService.isExpired(assignment)) {
    throw new AppError("This assignment has expired.", 410);
  }

  try {
    await batchAccessService.assertStudentEnrolled(getUserId(requester), assignment.batch);
    await validateUploadedFile(file, assignment);
    const submissionCount = await Submission.countDocuments({
      assignment: assignment._id,
      student: getUserId(requester),
    });

    if (submissionCount >= MAX_SUBMISSIONS_PER_ASSIGNMENT) {
      throw new AppError(
        "You already submitted this assignment. Use Edit submission to replace it.",
        409,
      );
    }

    const submission = await Submission.create({
      assignment: assignment._id,
      student: getUserId(requester),
      batch: assignment.batch,
      filePath: file.filename,
      fileName: sanitizeDisplayFileName(file.originalname),
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    try {
      // The ZIP is still on disk here, so copy what the AI needs into MongoDB now.
      await aiDraftService.saveSnapshot(submission, file);
    } catch {
      // AI work must never make the upload fail.
      console.error("AI snapshot could not be saved.");
    }

    // Best-effort similarity check against other submissions for the same assignment.
    try {
      await checkSimilarity(submission._id);
    } catch {
      // Similarity check must never make the upload fail.
      console.error("Similarity check could not be completed.");
    }

    return submission.populate(["assignment", "batch", "student"]);
  } catch (error) {
    await removeFile(file.path);
    throw error;
  }
}

async function updateSubmission({ requester, submissionId, file }) {
  assertObjectId(submissionId, "submission id");
  const submission = await Submission.findOne({
    _id: submissionId,
    student: getUserId(requester),
  }).populate("assignment");

  if (!submission) {
    throw new AppError("Submission not found.", 404);
  }

  const assignment = submission.assignment;
  assertCanReplace(submission, assignment);

  try {
    await batchAccessService.assertStudentEnrolled(getUserId(requester), assignment.batch);
    await validateUploadedFile(file, assignment);
    const previousPath = submission.filePath;
    // generations is lifetime data, so keep it even though the draft is reset.
    const generations = submission.aiDraft?.generations || 0;

    // Keep the old file as a version instead of deleting it.
    if (previousPath) {
      submission.versions = submission.versions || [];
      submission.versions.push({
        filePath: previousPath,
        fileName: submission.fileName,
        fileSize: submission.fileSize,
        uploadedAt: submission.submittedAt || new Date(),
      });
    }

    applyReplacementFile(submission, file);
    await submission.save();
    await saveReplacementSnapshot(submission, file, generations);

    return submission.populate(["assignment", "batch", "student"]);
  } catch (error) {
    await removeFile(file.path);
    throw error;
  }
}

module.exports = { createSubmission, updateSubmission, createLinkSubmission };
