// HTTP layer for GDPR export and deletion request.

const gdprService = require("../services/gdprService");
const asyncHandler = require("../utils/asyncHandler");

const exportData = asyncHandler(async (request, response) => {
  const result = await gdprService.exportUserData({
    requester: request.user,
    userId: request.params.id,
  });
  return response.json(result);
});

const requestDeletion = asyncHandler(async (request, response) => {
  const result = await gdprService.requestDeletion({
    requester: request.user,
    userId: request.params.id,
  });
  return response.json(result);
});

module.exports = { exportData, requestDeletion };
