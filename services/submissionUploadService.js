// Upload and replacement rules for submissions.
// One student has at most one submission per assignment; re-upload replaces it.

const path = require("path");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { MAX_SUBMISSIONS_PER_ASSIGNMENT } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const { isZipFile, removeFile, sanitizeDisplayFileName } = require("../utils/files");
const { assertArchiveIsSafe } = require("../utils/zip");
const { textSimilarity, extractSnapshotText } = require("../utils/similarity");
const { scanFile } = require("../utils/virusScan");
const batchAccessService = require("./batchAccessService");
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

  // Virus scan (fail closed).
  try {
    await scanFile(uploadedFile.path);
  } catch (error) {
    throw new AppError(error.message || "File rejected by virus scan.", 400);
  }
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

function assertCanReplace(submission, assignment) {
  if (!assignment.active || assignmentService.isExpired(assignment)) {
    throw new AppError("This assignment has expired.", 410);
  }

  // A graded submission is final. A rejected one may always be replaced.
  if (submission.status === "graded") {
    throw new AppError("A graded submission cannot be replaced.", 409);
  }

  // "disabled" only blocks a normal submitted file, not a rejected resubmission.
  if (assignment.resubmissionPolicy === "disabled" && submission.status === "submitted") {
    throw new AppError("Resubmissions are disabled for this assignment.", 409);
  }
}

async function checkSimilarity(submissionId) {
  const threshold = Number(process.env.SIMILARITY_THRESHOLD) || 0.6;

  const current = await Submission.findById(submissionId).select("+aiDraft.snapshot").lean();

  if (!current || !current.aiDraft?.snapshot) {
    return;
  }

  const currentText = extractSnapshotText(current.aiDraft.snapshot);
  if (!currentText.trim()) {
    return;
  }

  const others = await Submission.find({
    assignment: current.assignment,
    _id: { $ne: current._id },
  })
    .select("+aiDraft.snapshot")
    .lean();

  let bestMatch = null;
  let bestScore = 0;

  for (const other of others) {
    const otherText = extractSnapshotText(other.aiDraft?.snapshot);
    if (!otherText.trim()) {
      continue;
    }
    const score = textSimilarity(currentText, otherText);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = other._id;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    await Submission.updateOne(
      { _id: submissionId },
      {
        $set: { "similarityFlag.matchedSubmission": bestMatch, "similarityFlag.score": bestScore },
      },
    );
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
    // Copy the new ZIP text before the request ends, while the file still exists.
    await aiDraftService.saveSnapshot(submission, file, { generations });
  } catch {
    console.error("AI snapshot could not be saved.");
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

async function createLinkSubmission({ requester, assignmentId, linkUrl }) {
  const { assertString } = require("../utils/validation");
  const { AppError } = require("../utils/errors");
  const Assignment = require("../models/Assignment");

  assertObjectId(assignmentId, "assignmentId");
  const assignment = await Assignment.findById(assignmentId);

  if (!assignment) {
    throw new AppError("Assignment not found.", 404);
  }

  if (!assignment.active || assignmentService.isExpired(assignment)) {
    throw new AppError("This assignment has expired.", 410);
  }

  const allowedTypes = assignment.allowedFileTypes || ["zip"];
  if (!allowedTypes.includes("link")) {
    throw new AppError("Link submissions are not allowed for this assignment.", 400);
  }

  const url = assertString(linkUrl, "linkUrl", { maxLength: 2000 });

  await batchAccessService.assertStudentEnrolled(getUserId(requester), assignment.batch);

  const submissionCount = await Submission.countDocuments({
    assignment: assignment._id,
    student: getUserId(requester),
  });

  if (submissionCount >= MAX_SUBMISSIONS_PER_ASSIGNMENT) {
    throw new AppError("You already submitted this assignment.", 409);
  }

  const submission = await Submission.create({
    assignment: assignment._id,
    student: getUserId(requester),
    batch: assignment.batch,
    filePath: "",
    fileName: "link",
    fileSize: 0,
    mimeType: "text/uri-list",
    linkUrl: url,
  });

  return submission.populate(["assignment", "batch", "student"]);
}

module.exports = { createSubmission, updateSubmission, createLinkSubmission };
