// HTTP layer for analytics. Read-only.

const analyticsService = require("../services/analyticsService");
const asyncHandler = require("../utils/asyncHandler");

const batchAnalytics = asyncHandler(async (request, response) => {
  const result = await analyticsService.batchAnalytics({
    requester: request.user,
    batchId: request.params.id,
  });
  return response.json(result);
});

const overviewAnalytics = asyncHandler(async (request, response) => {
  const result = await analyticsService.overviewAnalytics({ requester: request.user });
  return response.json(result);
});

module.exports = { batchAnalytics, overviewAnalytics };
