// HTTP controller for the AI student assistant.
// Request validation and role-safe context are handled by the service.

const aiAssistantService = require("../services/aiAssistantService");
const asyncHandler = require("../utils/asyncHandler");

const ask = asyncHandler(async (request, response) => {
  const result = await aiAssistantService.askAssistant({
    requester: request.user,
    question: request.body.question,
    conversation: request.body.conversation,
  });
  return response.json(result);
});

module.exports = { ask };
