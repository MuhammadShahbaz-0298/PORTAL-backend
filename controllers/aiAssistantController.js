// HTTP layer for AI student assistant.

const aiAssistantService = require("../services/aiAssistantService");
const asyncHandler = require("../utils/asyncHandler");

const ask = asyncHandler(async (request, response) => {
  const result = await aiAssistantService.askAssistant({
    requester: request.user,
    question: request.body.question,
  });
  return response.json(result);
});

module.exports = { ask };
