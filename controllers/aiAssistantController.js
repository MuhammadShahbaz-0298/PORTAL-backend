// HTTP controller for a ia ss is ta nt co nt ro ll er.
// Keeps request and response handling separate from business rules.
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
