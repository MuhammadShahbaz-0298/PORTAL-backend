// Best-effort Expo push delivery for registered users.
// Delivery errors are logged without exposing device-token values.

const { Expo } = require("expo-server-sdk");
const DeviceToken = require("../models/DeviceToken");
const { PUSH_TITLE_MAX_LENGTH, PUSH_BODY_MAX_LENGTH } = require("../constants");
const { assertString } = require("../utils/validation");

const expo = new Expo();

function logPushError(error, tokens = []) {
  let message = "Unknown push delivery error.";
  if (error && typeof error.message === "string") {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }
  for (const token of tokens) {
    message = message.split(token).join("[redacted]");
  }
  console.error("[push_delivery_failed]", { error: message });
}

async function sendToUsers({ userIds, title, body, data }) {
  let tokens = [];
  try {
    const safeTitle = assertString(title, "push title", {
      maxLength: PUSH_TITLE_MAX_LENGTH,
    });
    const safeBody = assertString(body, "push body", {
      maxLength: PUSH_BODY_MAX_LENGTH,
    });
    const devices = await DeviceToken.find({ user: { $in: userIds } })
      .select("token")
      .lean();
    tokens = devices.map((device) => device.token);
    const messages = tokens.map((token) => ({
      to: token,
      title: safeTitle,
      body: safeBody,
      data,
    }));

    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        const invalidTokens = tickets.flatMap((ticket, index) =>
          ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
            ? [chunk[index].to]
            : [],
        );
        if (invalidTokens.length > 0) {
          await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
        }
      } catch (error) {
        logPushError(
          error,
          chunk.map((message) => message.to),
        );
      }
    }
  } catch (error) {
    logPushError(error, tokens);
  }
}

module.exports = { sendToUsers };
