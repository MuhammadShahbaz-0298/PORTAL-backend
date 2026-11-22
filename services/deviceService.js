// Database work for registered push devices.
// Each device token belongs to exactly one authenticated user.

const DeviceToken = require("../models/DeviceToken");
const {
  DEVICE_PLATFORMS,
  EXPO_PUSH_TOKEN_MAX_LENGTH,
  EXPO_PUSH_TOKEN_PATTERN,
} = require("../constants");
const { AppError } = require("../utils/errors");
const { assertEnum, assertObjectId, assertString, pickFields } = require("../utils/validation");

async function registerDevice({ userId, payload }) {
  const fields = pickFields(payload, ["token", "platform"]);
  const token = assertString(fields.token, "token", {
    maxLength: EXPO_PUSH_TOKEN_MAX_LENGTH,
  });
  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
    throw new AppError("Invalid Expo push token.", 400);
  }
  const platform = assertEnum(fields.platform, DEVICE_PLATFORMS, "platform");
  assertObjectId(userId, "user id");

  await DeviceToken.findOneAndUpdate(
    { token },
    {
      $set: { user: userId, platform, lastSeenAt: new Date() },
      $setOnInsert: { token },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return { message: "Device registered." };
}

async function unregisterDevice({ userId, token: rawToken }) {
  const token = assertString(rawToken, "token", {
    maxLength: EXPO_PUSH_TOKEN_MAX_LENGTH,
  });
  assertObjectId(userId, "user id");

  const result = await DeviceToken.deleteOne({ token, user: userId });
  if (result.deletedCount === 0) {
    throw new AppError("Device not found.", 404);
  }
  return { message: "Device unregistered." };
}

module.exports = { registerDevice, unregisterDevice };
