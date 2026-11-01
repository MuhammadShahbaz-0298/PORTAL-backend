// HTTP layer for batches and enrollment.

const batchService = require("../services/batchService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const getBatches = asyncHandler(async (request, response) => {
  const result = await batchService.listBatches({ requester: request.user, query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createBatch = asyncHandler(async (request, response) => {
  const batch = await batchService.createBatch({
    requester: request.user,
    payload: request.body,
  });
  return response.status(201).json(batch);
});

const updateBatch = asyncHandler(async (request, response) => {
  const batch = await batchService.updateBatch({
    requester: request.user,
    batchId: request.params.id,
    payload: request.body,
  });
  return response.json(batch);
});

const deleteBatch = asyncHandler(async (request, response) => {
  const result = await batchService.deleteBatch({
    requester: request.user,
    batchId: request.params.id,
  });
  return response.json(result);
});

const archiveBatch = asyncHandler(async (request, response) => {
  const result = await batchService.archiveBatch({
    requester: request.user,
    batchId: request.params.id,
  });
  return response.json(result);
});

const enrollStudent = asyncHandler(async (request, response) => {
  const enrollment = await batchService.enrollStudent({
    requester: request.user,
    batchId: request.params.id,
    payload: request.body,
  });
  return response.status(201).json(enrollment);
});

const getBatchStudents = asyncHandler(async (request, response) => {
  const result = await batchService.getBatchStudents({
    requester: request.user,
    batchId: request.params.id,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

module.exports = {
  getBatches,
  createBatch,
  updateBatch,
  archiveBatch,
  deleteBatch,
  enrollStudent,
  getBatchStudents,
};
