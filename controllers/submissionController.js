// HTTP layer for submissions, grading, downloads and AI drafts.

const submissionService = require("../services/submissionService");
const aiDraftService = require("../services/aiDraftService");
const submissionView = require("../utils/submissionView");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

// Generation starts only after the HTTP response has been sent.
function startDraftAfterResponse(response, submission) {
  if (submission?.aiDraft?.status === "pending") {
    response.once("finish", () => aiDraftService.startDraftGeneration(submission._id));
  }
}

const createSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.createSubmission({
    requester: request.user,
    assignmentId: request.body.assignmentId,
    file: request.file,
  });
  startDraftAfterResponse(response, submission);

  return response.status(201).json(submissionView.toVisibleSubmission(submission, request.user));
});

const updateSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.updateSubmission({
    requester: request.user,
    submissionId: request.params.id,
    file: request.file,
  });
  startDraftAfterResponse(response, submission);

  return response.json(submissionView.toVisibleSubmission(submission, request.user));
});

const getSubmissions = asyncHandler(async (request, response) => {
  const result = await submissionService.listSubmissions({
    requester: request.user,
    query: request.query,
  });
  const visibleItems = submissionView.toVisibleSubmissionList(result.items, request.user);

  return sendPaginatedList(response, visibleItems, result.pagination, result.total);
});

const gradeSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.gradeSubmission({
    requester: request.user,
    submission: request.submission,
    payload: request.body,
  });
  return response.json(submissionView.toVisibleSubmission(submission, request.user));
});

const regenerateAiDraft = asyncHandler(async (request, response) => {
  const submission = await aiDraftService.regenerateDraft({
    submission: request.submission,
  });
  startDraftAfterResponse(response, submission);

  return response.json(submissionView.toVisibleSubmission(submission, request.user));
});

const discardAiDraft = asyncHandler(async (request, response) => {
  const submission = await aiDraftService.discardDraft({
    submission: request.submission,
  });
  return response.json(submissionView.toVisibleSubmission(submission, request.user));
});

const downloadSubmission = asyncHandler(async (request, response) => {
  const download = await submissionService.getSubmissionForDownload({
    requester: request.user,
    submissionId: request.params.id,
  });

  // res.download always sends Content-Disposition: attachment.
  return response.download(download.filePath, download.downloadName);
});

const getVersions = asyncHandler(async (request, response) => {
  const versions = await submissionService.getSubmissionVersions({
    requester: request.user,
    submissionId: request.params.id,
  });
  return response.json(versions);
});

module.exports = {
  createSubmission,
  updateSubmission,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
  regenerateAiDraft,
  discardAiDraft,
  getVersions,
};
