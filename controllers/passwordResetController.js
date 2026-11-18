// HTTP layer for self-service password reset.

const passwordResetService = require("../services/passwordResetService");
const asyncHandler = require("../utils/asyncHandler");

const forgotPassword = asyncHandler(async (request, response) => {
  const result = await passwordResetService.requestReset({
    email: request.body.email,
  });
  return response.json(result);
});

const resetPassword = asyncHandler(async (request, response) => {
  const result = await passwordResetService.consumeReset({
    token: request.body.token,
    newPassword: request.body.newPassword,
  });
  return response.json(result);
});

module.exports = { forgotPassword, resetPassword };
