// HTTP layer for AI assignment draft.

const aiAssignmentDraftService = require("../services/aiAssignmentDraftService");
const asyncHandler = require("../utils/asyncHandler");

const generateDraft = asyncHandler(async (request, response) => {
  const result = await aiAssignmentDraftService.generateAssignmentDraft({
    idea: request.body.idea,
  });
  return response.json(result);
});

module.exports = { generateDraft };
