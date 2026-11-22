// Stores one Expo push token registered by a portal user.
// A token is unique because Expo tokens identify one app installation.

const mongoose = require("mongoose");
const { DEVICE_PLATFORMS, EXPO_PUSH_TOKEN_MAX_LENGTH } = require("../constants");

const deviceTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      maxlength: EXPO_PUSH_TOKEN_MAX_LENGTH,
    },
    platform: {
      type: String,
      required: true,
      enum: DEVICE_PLATFORMS,
    },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true },
);

module.exports = mongoose.model("DeviceToken", deviceTokenSchema);
