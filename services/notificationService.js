// Database work and creation helpers for notifications.
// A notification is created for one recipient.

const Notification = require("../models/Notification");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
} = require("../constants");
const { AppError } = require("../utils/errors");
const { assertObjectId, assertString, assertEnum } = require("../utils/validation");

// Creates one notification. Used by every trigger below so the logic stays in one place.
async function createNotification({
  recipientId,
  type,
  message,
  channel = NOTIFICATION_CHANNEL.IN_APP,
  link,
}) {
  assertObjectId(recipientId, "recipient id");
  assertEnum(type, Object.values(NOTIFICATION_TYPES), "type");
  assertString(message, "message", { maxLength: NOTIFICATION_MESSAGE_MAX_LENGTH });
  assertEnum(channel, NOTIFICATION_CHANNELS, "channel");

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    message,
    channel,
    link: link || undefined,
  });
  return notification;
}

async function notifySubmissionGraded({ submission, gradedBy: _gradedBy }) {
  return createNotification({
    recipientId: String(submission.student),
    type: NOTIFICATION_TYPES.SUBMISSION_GRADED,
    message: `Your submission for "${submission.assignmentTitle || "an assignment"}" has been graded.`,
    link: `/submissions/${submission._id}`,
  });
}

async function notifyNewAssignment({ assignment, batch: _batch, studentIds }) {
  const notifications = [];
  for (const studentId of studentIds) {
    notifications.push(
      createNotification({
        recipientId: String(studentId),
        type: NOTIFICATION_TYPES.NEW_ASSIGNMENT,
        message: `New assignment: ${assignment.title}`,
        link: `/assignments/${assignment._id}`,
      }),
    );
  }
  return Promise.all(notifications);
}

async function notifyNewQuiz({ quiz, studentIds }) {
  const notifications = [];
  for (const studentId of studentIds) {
    notifications.push(
      createNotification({
        recipientId: String(studentId),
        type: NOTIFICATION_TYPES.NEW_QUIZ,
        message: `New quiz: ${quiz.title}`,
        link: `/quizzes/${quiz._id}`,
      }),
    );
  }
  return Promise.all(notifications);
}

async function notifyAdminReset({ userId }) {
  return createNotification({
    recipientId: String(userId),
    type: NOTIFICATION_TYPES.PASSWORD_RESET,
    message:
      "Your password was reset by an administrator. Please sign in with your temporary password.",
    link: "/auth/change-password",
  });
}

async function notifyAiDraftReady({ submission, teacherId }) {
  return createNotification({
    recipientId: String(teacherId),
    type: NOTIFICATION_TYPES.AI_DRAFT_READY,
    message: `AI feedback draft is ready for submission ${submission._id}.`,
    link: `/submissions/${submission._id}`,
  });
}

async function notifyAnnouncement({ announcement, recipientIds }) {
  const notifications = [];
  for (const recipientId of recipientIds) {
    notifications.push(
      createNotification({
        recipientId: String(recipientId),
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        message: announcement.title,
        link: `/announcements/${announcement._id}`,
      }),
    );
  }
  return Promise.all(notifications);
}

async function listNotifications({ recipientId, query }) {
  const { getPagination } = require("../utils/pagination");
  const pagination = getPagination(query);
  const filter = { recipient: recipientId };
  const total = await Notification.countDocuments(filter);
  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

async function markAsRead({ recipientId, notificationId }) {
  assertObjectId(notificationId, "notification id");

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: recipientId,
  });

  if (!notification) {
    throw new AppError("Notification not found.", 404);
  }

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
}

async function clearAllForRecipient({ recipientId }) {
  const result = await Notification.deleteMany({ recipient: recipientId });
  return { deletedCount: result.deletedCount || 0 };
}

module.exports = {
  createNotification,
  notifySubmissionGraded,
  notifyNewAssignment,
  notifyNewQuiz,
  notifyAdminReset,
  notifyAiDraftReady,
  notifyAnnouncement,
  listNotifications,
  markAsRead,
  clearAllForRecipient,
};
