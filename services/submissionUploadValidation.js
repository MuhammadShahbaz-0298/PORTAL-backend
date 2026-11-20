// Validate uploaded submission files and prepare replacements.
// Replacement helpers preserve graded-state and version-history rules.

const path = require("path");
const { AppError } = require("../utils/errors");
const { isZipFile, sanitizeDisplayFileName } = require("../utils/files");
const { assertArchiveIsSafe } = require("../utils/zip");
const assignmentService = require("./assignmentService");
const aiDraftService = require("./aiDraftService");

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
  const allowedTypes = assignment.allowedFileTypes || ["zip"];

  if (!allowedTypes.includes(fileType) && !(fileType === "zip" && allowedTypes.includes("zip"))) {
    throw new AppError(`File type ${fileType} is not allowed for this assignment.`, 400);
  }

  if (fileType === "zip") {
    if (!(await isZipFile(uploadedFile.path))) {
      throw new AppError("The uploaded file is not a valid ZIP archive.", 400);
    }
    await assertArchiveIsSafe(uploadedFile.path);
  }
}

function assertCanReplace(submission, assignment) {
  if (!assignment.active || assignmentService.isExpired(assignment)) {
    throw new AppError("This assignment has expired.", 410);
  }
  if (submission.status === "graded") {
    throw new AppError("A graded submission cannot be replaced.", 409);
  }
  if (assignment.resubmissionPolicy === "disabled" && submission.status === "submitted") {
    throw new AppError("Resubmissions are disabled for this assignment.", 409);
  }
}

function applyReplacementFile(submission, file) {
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
  submission.aiDraft = undefined;
}

async function saveReplacementSnapshot(submission, file, generations) {
  try {
    await aiDraftService.saveSnapshot(submission, file, { generations });
  } catch {
    console.error("AI snapshot could not be saved.");
  }
}

module.exports = {
  requireUploadedFile,
  validateUploadedFile,
  assertCanReplace,
  applyReplacementFile,
  saveReplacementSnapshot,
};
