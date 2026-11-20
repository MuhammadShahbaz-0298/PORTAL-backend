// Create link-based assignment submissions.
// Link submissions follow the same enrollment and one-submission rules as uploads.

const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { MAX_SUBMISSIONS_PER_ASSIGNMENT } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");
const { assertObjectId, assertString } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");
const assignmentService = require("./assignmentService");

async function createLinkSubmission({ requester, assignmentId, linkUrl }) {
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
  const studentId = getUserId(requester);
  await batchAccessService.assertStudentEnrolled(studentId, assignment.batch);

  const submissionCount = await Submission.countDocuments({
    assignment: assignment._id,
    student: studentId,
  });
  if (submissionCount >= MAX_SUBMISSIONS_PER_ASSIGNMENT) {
    throw new AppError("You already submitted this assignment.", 409);
  }

  const submission = await Submission.create({
    assignment: assignment._id,
    student: studentId,
    batch: assignment.batch,
    filePath: "",
    fileName: "link",
    fileSize: 0,
    mimeType: "text/uri-list",
    linkUrl: url,
  });

  return submission.populate(["assignment", "batch", "student"]);
}

module.exports = { createLinkSubmission };
