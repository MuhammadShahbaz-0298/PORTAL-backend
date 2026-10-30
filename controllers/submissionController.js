// HTTP layer for submissions, grading and downloads.

const submissionService = require("../services/submissionService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const createSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.createSubmission({
    requester: request.user,
    assignmentId: request.body.assignmentId,
    file: request.file,
  });
  return response.status(201).json(submission);
});

const updateSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.updateSubmission({
    requester: request.user,
    submissionId: request.params.id,
    file: request.file,
  });
  return response.json(submission);
});

const getSubmissions = asyncHandler(async (request, response) => {
  const result = await submissionService.listSubmissions({
    requester: request.user,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const gradeSubmission = asyncHandler(async (request, response) => {
  const submission = await submissionService.gradeSubmission({
    requester: request.user,
    submission: request.submission,
    payload: request.body,
  });
  return response.json(submission);
});

const downloadSubmission = asyncHandler(async (request, response) => {
  const download = await submissionService.getSubmissionForDownload({
    requester: request.user,
    submissionId: request.params.id,
  });

  // res.download always sends Content-Disposition: attachment.
  return response.download(download.filePath, download.downloadName);
});

module.exports = {
  createSubmission,
  updateSubmission,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
};
