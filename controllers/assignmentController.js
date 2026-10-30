// HTTP layer for assignments.

const assignmentService = require("../services/assignmentService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listAssignments = asyncHandler(async (request, response) => {
  const result = await assignmentService.listAssignments({
    requester: request.user,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const getAssignment = asyncHandler(async (request, response) => {
  const assignment = await assignmentService.getAssignment({
    requester: request.user,
    assignmentId: request.params.id,
  });
  return response.json(assignment);
});

const createAssignment = asyncHandler(async (request, response) => {
  const assignment = await assignmentService.createAssignment({
    requester: request.user,
    payload: request.body,
  });
  return response.status(201).json(assignment);
});

const updateAssignment = asyncHandler(async (request, response) => {
  const assignment = await assignmentService.updateAssignment({
    requester: request.user,
    assignmentId: request.params.id,
    payload: request.body,
  });
  return response.json(assignment);
});

const deleteAssignment = asyncHandler(async (request, response) => {
  const result = await assignmentService.deleteAssignment({
    requester: request.user,
    assignmentId: request.params.id,
  });
  return response.json(result);
});

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
