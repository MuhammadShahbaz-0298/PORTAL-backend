// Handle HTTP requests for batches and enrollment.
// Delegate business rules and ownership checks to the batch service.

const batchService = require("../services/batchService");
const batchEnrollmentService = require("../services/batchEnrollmentService");
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
  const enrollment = await batchEnrollmentService.enrollStudent({
    requester: request.user,
    batchId: request.params.id,
    payload: request.body,
  });
  return response.status(201).json(enrollment);
});

const unenrollStudent = asyncHandler(async (request, response) => {
  const result = await batchEnrollmentService.unenrollStudent({
    requester: request.user,
    batchId: request.params.id,
    studentId: request.params.studentId,
  });
  return response.json(result);
});

const getBatchStudents = asyncHandler(async (request, response) => {
  const result = await batchService.getBatchStudents({
    requester: request.user,
    batchId: request.params.id,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const getEligibleStudents = asyncHandler(async (request, response) => {
  const result = await batchService.getEligibleStudents({
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
  unenrollStudent,
  getBatchStudents,
  getEligibleStudents,
};
