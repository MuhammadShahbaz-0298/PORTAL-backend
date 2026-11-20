// HTTP controller for comments on submissions.
// Keeps request and response handling separate from business rules.

const commentService = require("../services/commentService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listComments = asyncHandler(async (request, response) => {
  const result = await commentService.listComments({
    requester: request.user,
    submissionId: request.params.submissionId,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createComment = asyncHandler(async (request, response) => {
  const comment = await commentService.createComment({
    requester: request.user,
    submissionId: request.params.submissionId,
    payload: request.body,
  });
  return response.status(201).json(comment);
});

const archiveComment = asyncHandler(async (request, response) => {
  const result = await commentService.archiveComment({
    requester: request.user,
    commentId: request.params.id,
  });
  return response.json(result);
});

module.exports = { listComments, createComment, archiveComment };
