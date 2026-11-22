// A notification is an in-app message (and optionally an email) sent to one user.
// Recipients can clear their own notifications; they cannot affect other users.

const mongoose = require("mongoose");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
} = require("../constants");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: NOTIFICATION_MESSAGE_MAX_LENGTH,
    },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      default: NOTIFICATION_CHANNEL.IN_APP,
    },
    emailSent: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    link: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, strict: true },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
