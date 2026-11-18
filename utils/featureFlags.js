// Checks whether a feature is enabled via the FeatureFlag collection.
// Falls back to false when the flag does not exist.

const FeatureFlag = require("../models/FeatureFlag");

async function isFeatureEnabled(key) {
  const flag = await FeatureFlag.findOne({ key }).lean();
  if (!flag) {
    return false;
  }
  return flag.enabled === true;
}

module.exports = { isFeatureEnabled };
