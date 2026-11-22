// Handles HTTP requests for push-device registration.
// User identity comes from authentication, never from the request body.

const deviceService = require("../services/deviceService");
const asyncHandler = require("../utils/asyncHandler");

const registerDevice = asyncHandler(async (request, response) => {
  const result = await deviceService.registerDevice({
    userId: request.user.userId,
    payload: request.body,
  });
  return response.status(201).json(result);
});

const unregisterDevice = asyncHandler(async (request, response) => {
  const result = await deviceService.unregisterDevice({
    userId: request.user.userId,
    token: request.params.token,
  });
  return response.json(result);
});

module.exports = { registerDevice, unregisterDevice };
