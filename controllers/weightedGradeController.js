// HTTP controller for w ei gh te dg ra de co nt ro ll er.
// Keeps request and response handling separate from business rules.
// HTTP layer for weighted grade computation.

const weightedGradeService = require("../services/weightedGradeService");
const asyncHandler = require("../utils/asyncHandler");

const getWeightedScore = asyncHandler(async (request, response) => {
  const result = await weightedGradeService.computeWeightedScore({
    requester: request.user,
    studentId: request.params.studentId,
    batchId: request.query.batchId,
  });
  return response.json(result);
});

module.exports = { getWeightedScore };
