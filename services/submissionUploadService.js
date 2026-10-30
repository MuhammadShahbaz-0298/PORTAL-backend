// Upload and replacement rules for submissions.
// One student has at most one submission per assignment; re-upload replaces it.

const path = require("path");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { MAX_SUBMISSIONS_PER_ASSIGNMENT } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const {
  isZipFile,
  removeFile,
  resolveUploadPath,
  sanitizeDisplayFileName,
} = require("../utils/files");
const { assertArchiveIsSafe } = require("../utils/zip");
const batchAccessService = require("./batchAccessService");
const assignmentService = require("./assignmentService");

function requireUploadedFile(file) {
  if (!file) {
    throw new AppError("No file uploaded.", 400);
  }

  return file;
}

async function validateUploadedFile(file, assignment) {
  const uploadedFile = requireUploadedFile(file);
  const maximumBytes = assignment.maxFileSizeMb * 1024 * 1024;

  if (uploadedFile.size > maximumBytes) {
    throw new AppError(`File exceeds the ${assignment.maxFileSizeMb}MB limit.`, 400);
  }

  const fileType = path.extname(uploadedFile.originalname).slice(1).toLowerCase();
  if (fileType !== "zip") {
    throw new AppError("Only .zip files are allowed.", 400);
  }

  if (!(await isZipFile(uploadedFile.path))) {
    throw new AppError("The uploaded file is not a valid ZIP archive.", 400);
  }

  await assertArchiveIsSafe(uploadedFile.path);
}

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
      attempt: 1,
    });

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
  if (!assignment.active || assignmentService.isExpired(assignment)) {
    throw new AppError("This assignment has expired.", 410);
  }

  if (assignment.resubmissionPolicy === "disabled") {
    throw new AppError("Resubmissions are disabled for this assignment.", 403);
  }

  try {
    await batchAccessService.assertStudentEnrolled(getUserId(requester), assignment.batch);
    await validateUploadedFile(file, assignment);
    const previousPath = submission.filePath;

    submission.filePath = file.filename;
    submission.fileName = sanitizeDisplayFileName(file.originalname);
    submission.fileSize = file.size;
    submission.mimeType = file.mimetype;
    submission.status = "submitted";
    submission.grade = null;
    submission.feedback = null;
    submission.gradedBy = null;
    submission.gradedAt = null;
    submission.submittedAt = new Date();
    await submission.save();

    if (previousPath) {
      await removeFile(resolveUploadPath(previousPath));
    }

    return submission.populate(["assignment", "batch", "student"]);
  } catch (error) {
    await removeFile(file.path);
    throw error;
  }
}

module.exports = { createSubmission, updateSubmission, validateUploadedFile };
