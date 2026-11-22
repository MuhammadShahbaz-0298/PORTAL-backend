// Database work for announcements.
// Teachers/admins create for a batch or school-wide; readers see their own batch or school-wide ones.

const Announcement = require("../models/Announcement");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { ANNOUNCEMENT_SCOPES, ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, isAdmin } = require("../utils/authorization");
const { assertObjectId, assertString, pickFields } = require("../utils/validation");
const { readPushSettings } = require("../config/env");
const batchAccessService = require("./batchAccessService");
const notificationService = require("./notificationService");
const announcementReadService = require("./announcementReadService");
const pushService = require("./pushService");

async function createAnnouncement({ requester, payload }) {
  const fields = pickFields(payload, ["title", "body", "scope", "batchId"]);
  const title = assertString(fields.title, "title", { maxLength: 200 });
  const body = assertString(fields.body, "body", { maxLength: 5000 });
  const scope = assertString(fields.scope, "scope");

  if (!ANNOUNCEMENT_SCOPES.includes(scope)) {
    throw new AppError(`Scope must be one of: ${ANNOUNCEMENT_SCOPES.join(", ")}.`, 400);
  }

  let batchId = null;
  if (scope === "batch") {
    batchId = assertObjectId(fields.batchId, "batch id");
    await batchAccessService.assertCanManageBatch(requester, batchId);
  }

  const announcement = await Announcement.create({
    title,
    body,
    scope,
    batch: batchId || undefined,
    createdBy: getUserId(requester),
  });

  // Notify the audience. This is best-effort; announcement creation still succeeds if it fails.
  try {
    const recipientIds = await announcementRecipientIds(scope, batchId, getUserId(requester));
    await notificationService.notifyAnnouncement({
      announcement: { _id: announcement._id, title },
      recipientIds,
    });
  } catch (error) {
    console.error("[announcement_notification_failed]", {
      announcementId: String(announcement._id),
      error: error.message,
    });
  }

  if (readPushSettings().enabled) {
    try {
      const studentIds = await announcementStudentIds(scope, batchId);
      void pushService.sendToUsers({
        userIds: studentIds,
        title,
        body,
        data: { screen: "announcements", announcementId: String(announcement._id) },
      }).catch((error) => {
        console.error("[announcement_push_failed]", {
          announcementId: String(announcement._id),
          error: error.name,
        });
      });
    } catch (error) {
      console.error("[announcement_push_recipients_failed]", {
        announcementId: String(announcement._id),
        error: error.message,
      });
    }
  }

  await announcement.populate("createdBy", "name email role");
  await announcement.populate("batch", "name");
  return announcement;
}

async function updateAnnouncement({ requester, announcementId, payload }) {
  assertObjectId(announcementId, "announcement id");
  const announcement = await Announcement.findById(announcementId);

  if (!announcement) {
    throw new AppError("Announcement not found.", 404);
  }

  if (!isAdmin(requester) && String(announcement.createdBy) !== getUserId(requester)) {
    throw new AppError("You do not own this announcement.", 403);
  }

  const fields = pickFields(payload, ["title", "body", "scope", "batchId", "active"]);

  if (fields.title !== undefined) {
    announcement.title = assertString(fields.title, "title", { maxLength: 200 });
  }
  if (fields.body !== undefined) {
    announcement.body = assertString(fields.body, "body", { maxLength: 5000 });
  }
  if (fields.scope !== undefined) {
    if (!ANNOUNCEMENT_SCOPES.includes(fields.scope)) {
      throw new AppError(`Scope must be one of: ${ANNOUNCEMENT_SCOPES.join(", ")}.`, 400);
    }
    announcement.scope = fields.scope;
  }
  if (fields.batchId !== undefined && announcement.scope === "batch") {
    const batchId = assertObjectId(fields.batchId, "batch id");
    await batchAccessService.assertCanManageBatch(requester, batchId);
    announcement.batch = batchId;
  }
  if (fields.active !== undefined) {
    announcement.active = fields.active === true;
    if (!announcement.active) {
      announcement.archivedAt = new Date();
    } else {
      announcement.archivedAt = null;
    }
  }

  await announcement.save();
  await announcement.populate("createdBy", "name email role");
  await announcement.populate("batch", "name");
  return announcement;
}

async function archiveAnnouncement({ requester, announcementId }) {
  assertObjectId(announcementId, "announcement id");
  const announcement = await Announcement.findById(announcementId);

  if (!announcement) {
    throw new AppError("Announcement not found.", 404);
  }

  if (!isAdmin(requester) && String(announcement.createdBy) !== getUserId(requester)) {
    throw new AppError("You do not own this announcement.", 403);
  }

  announcement.active = false;
  announcement.archivedAt = new Date();
  await announcement.save();

  return { message: "Announcement archived successfully." };
}

// Resolves the user ids who should receive a notification for an announcement.
async function announcementRecipientIds(scope, batchId, authorId) {
  if (scope === "school") {
    const users = await User.find({
      active: true,
      _id: { $ne: authorId },
    })
      .select("_id")
      .lean();
    return users.map((user) => user._id);
  }

  if (scope === "batch" && batchId) {
    const enrollments = await Enrollment.find({
      batch: batchId,
      active: { $ne: false },
    })
      .select("student")
      .lean();
    return enrollments
      .map((enrollment) => enrollment.student)
      .filter((studentId) => String(studentId) !== String(authorId));
  }

  return [];
}

async function announcementStudentIds(scope, batchId) {
  const userFilter = { role: ROLES.STUDENT, active: true };
  if (scope === "batch" && batchId) {
    const studentIds = await Enrollment.distinct("student", {
      batch: batchId,
      active: { $ne: false },
    });
    userFilter._id = { $in: studentIds };
  }

  const students = await User.find(userFilter).select("_id").lean();
  return students.map((student) => student._id);
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
  ...announcementReadService,
};
