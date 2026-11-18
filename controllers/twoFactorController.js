// HTTP layer for 2FA.

const twoFactorService = require("../services/twoFactorService");
const asyncHandler = require("../utils/asyncHandler");

const setup = asyncHandler(async (request, response) => {
  const result = await twoFactorService.setupTwoFactor({ requester: request.user });
  return response.json(result);
});

const verify = asyncHandler(async (request, response) => {
  const result = await twoFactorService.verifyTwoFactor({
    requester: request.user,
    code: request.body.code,
  });
  return response.json(result);
});

const disable = asyncHandler(async (request, response) => {
  const result = await twoFactorService.disableTwoFactor({ requester: request.user });
  return response.json(result);
});

module.exports = { setup, verify, disable };
