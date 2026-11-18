// Database work for announcements.
// Teachers/admins create for a batch or school-wide; readers see their own batch or school-wide ones.

const Announcement = require("../models/Announcement");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { ROLES, ANNOUNCEMENT_SCOPES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const { assertObjectId, assertString, pickFields } = require("../utils/validation");
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const notificationService = require("./notificationService");

async function listAnnouncements({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["title", "body"]);
  const filters = [{ active: true }, searchFilter];
  const role = getUserRole(requester);

  if (role === ROLES.ADMIN) {
    // Admins see everything.
  } else if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({
      $or: [{ scope: "school" }, { scope: "batch", batch: { $in: ownedBatchIds } }],
    });
  } else if (role === ROLES.STUDENT || role === "guardian") {
    const studentId = getUserId(requester);
    const batchIds =
      role === ROLES.STUDENT ? await batchAccessService.getStudentBatchIds(studentId) : [];
    filters.push({
      $or: [{ scope: "school" }, { scope: "batch", batch: { $in: batchIds } }],
    });
  } else {
    filters.push({ scope: "school" });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await Announcement.countDocuments(filter);
  const items = await Announcement.find(filter)
    .populate("createdBy", "name email role")
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

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
    const recipientIds = await announcementRecipientIds(scope, batchId);
    await notificationService.notifyAnnouncement({
      announcement: { _id: announcement._id, title },
      recipientIds,
    });
  } catch {
    // Do not let notification failures break announcement creation.
  }

  return announcement.populate("createdBy", "name email role").populate("batch", "name");
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
  return announcement.populate("createdBy", "name email role").populate("batch", "name");
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
async function announcementRecipientIds(scope, batchId) {
  if (scope === "school") {
    const users = await User.find({ active: true }).select("_id").lean();
    return users.map((user) => user._id);
  }

  if (scope === "batch" && batchId) {
    const enrollments = await Enrollment.find({ batch: batchId }).select("student").lean();
    return enrollments.map((enrollment) => enrollment.student);
  }

  return [];
}

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
};
