// HTTP layer for feature flags. Read-only list + toggle.

const FeatureFlag = require("../models/FeatureFlag");
const { isFeatureEnabled } = require("../utils/featureFlags");
const { assertString } = require("../utils/validation");
const asyncHandler = require("../utils/asyncHandler");

const listFlags = asyncHandler(async (request, response) => {
  const flags = await FeatureFlag.find().sort({ key: 1 }).lean();
  return response.json(flags);
});

const checkFlag = asyncHandler(async (request, response) => {
  const enabled = await isFeatureEnabled(request.params.key);
  return response.json({ key: request.params.key, enabled });
});

const upsertFlag = asyncHandler(async (request, response) => {
  const key = assertString(request.body.key, "key", { maxLength: 100 });
  const enabled = request.body.enabled === true;

  const flag = await FeatureFlag.findOneAndUpdate(
    { key },
    { key, enabled, description: request.body.description },
    { upsert: true, new: true },
  );

  return response.json(flag);
});

module.exports = { listFlags, checkFlag, upsertFlag };
