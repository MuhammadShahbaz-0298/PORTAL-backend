// HTTP layer for email verification.

const emailVerificationService = require("../services/emailVerificationService");
const asyncHandler = require("../utils/asyncHandler");

const verifyEmail = asyncHandler(async (request, response) => {
  const result = await emailVerificationService.verifyEmail({
    token: request.params.token,
  });
  return response.json(result);
});

module.exports = { verifyEmail };
