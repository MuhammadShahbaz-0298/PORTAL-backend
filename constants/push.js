// Constants for Expo push registration and delivery.
// Shared by request validation, persistence and message construction.

const DEVICE_PLATFORMS = Object.freeze(["ios", "android"]);
const EXPO_PUSH_TOKEN_MAX_LENGTH = 256;
const EXPO_PUSH_TOKEN_PATTERN = /^ExponentPushToken\[[^\]]+\]$/;
const PUSH_TITLE_MAX_LENGTH = 200;
const PUSH_BODY_MAX_LENGTH = 2000;

module.exports = {
  DEVICE_PLATFORMS,
  EXPO_PUSH_TOKEN_MAX_LENGTH,
  EXPO_PUSH_TOKEN_PATTERN,
  PUSH_TITLE_MAX_LENGTH,
  PUSH_BODY_MAX_LENGTH,
};
