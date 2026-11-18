// HTTP layer for session/device management.

const sessionService = require("../services/sessionService");
const { getUserId } = require("../utils/authorization");
const asyncHandler = require("../utils/asyncHandler");

const listSessions = asyncHandler(async (request, response) => {
  const sessions = await sessionService.listSessionsForUser(getUserId(request.user));
  return response.json(sessions);
});

const revokeSession = asyncHandler(async (request, response) => {
  await sessionService.revokeSession(request.params.id);
  return response.json({ message: "Session revoked." });
});

module.exports = { listSessions, revokeSession };
