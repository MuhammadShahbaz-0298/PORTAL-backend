// Database work and creation helpers for notifications.
// A notification is created for one recipient and may also be emailed.

const Notification = require("../models/Notification");
const { NOTIFICATION_TYPES } = require("../constants");
const { AppError } = require("../utils/errors");
const { assertObjectId, assertString, assertEnum } = require("../utils/validation");
const { sendMail } = require("../utils/mailer");
const { logSecurityEvent } = require("../utils/securityLog");

// Creates one notification. Used by every trigger below so the logic stays in one place.
async function createNotification({ recipientId, type, message, channel = "inApp", link }) {
  assertObjectId(recipientId, "recipient id");
  assertEnum(type, Object.values(NOTIFICATION_TYPES), "type");
  assertString(message, "message", { maxLength: 2000 });

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    message,
    channel,
    link: link || undefined,
  });

  // Email is best-effort: a mail failure must never block the in-app notification.
  if (channel === "email") {
    try {
      await sendMail({
        to: String(recipientId),
        subject: notificationTypeSubject(type),
        text: message,
      });
      notification.emailSent = true;
      await notification.save();
    } catch (error) {
      if (error.code === "EMAIL_NOT_CONFIGURED") {
        logSecurityEvent("email_not_configured", { type, recipientId });
      } else {
        logSecurityEvent("email_send_failed", { type, recipientId });
      }
    }
  }

  return notification;
}

function notificationTypeSubject(type) {
  const subjects = {
    [NOTIFICATION_TYPES.SUBMISSION_GRADED]: "Your submission has been graded",
    [NOTIFICATION_TYPES.NEW_ASSIGNMENT]: "New assignment posted",
    [NOTIFICATION_TYPES.PASSWORD_RESET]: "Your password was reset",
    [NOTIFICATION_TYPES.AI_DRAFT_READY]: "AI feedback draft is ready",
    [NOTIFICATION_TYPES.ANNOUNCEMENT]: "New announcement",
    [NOTIFICATION_TYPES.RISK_FLAG]: "At-risk flag raised",
    [NOTIFICATION_TYPES.EMAIL_VERIFICATION]: "Verify your email address",
  };
  return subjects[type] || "Notification";
}

// Trigger: a submission was graded. Notify the student who owns it.
async function notifySubmissionGraded({ submission, gradedBy: _gradedBy }) {
  return createNotification({
    recipientId: String(submission.student),
    type: NOTIFICATION_TYPES.SUBMISSION_GRADED,
    message: `Your submission for "${submission.assignmentTitle || "an assignment"}" has been graded.`,
    link: `/submissions/${submission._id}`,
  });
}

// Trigger: a new assignment was posted in a batch. Notify every enrolled student.
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

// Trigger: an admin reset a user's password. Notify that user.
async function notifyPasswordReset({ userId }) {
  return createNotification({
    recipientId: String(userId),
    type: NOTIFICATION_TYPES.PASSWORD_RESET,
    message:
      "Your password was reset by an administrator. Please sign in with your temporary password.",
    link: "/auth/change-password",
  });
}

// Trigger: an AI feedback draft is ready. Notify the grading teacher.
async function notifyAiDraftReady({ submission, teacherId }) {
  return createNotification({
    recipientId: String(teacherId),
    type: NOTIFICATION_TYPES.AI_DRAFT_READY,
    message: `AI feedback draft is ready for submission ${submission._id}.`,
    link: `/submissions/${submission._id}`,
  });
}

// Trigger: an announcement was posted. Notify the relevant audience.
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

// List notifications for one user, newest first.
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

// Mark one notification as read. Only the recipient may do this.
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

module.exports = {
  createNotification,
  notifySubmissionGraded,
  notifyNewAssignment,
  notifyPasswordReset,
  notifyAiDraftReady,
  notifyAnnouncement,
  listNotifications,
  markAsRead,
};
