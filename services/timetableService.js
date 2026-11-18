// Database work for timetable entries.
// Scoped to batch ownership, same as attendance.

const TimetableEntry = require("../models/TimetableEntry");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId, assertString, assertEnum, pickFields } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const { DAYS_OF_WEEK } = require("../constants");

async function listEntries({ requester, query }) {
  const pagination = getPagination(query);
  const filters = [{ active: true }];
  const role = getUserRole(requester);

  const batchId = query.batchId;
  if (batchId) {
    filters.push({ batch: assertObjectId(batchId, "batch id") });
  }

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  } else if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ batch: { $in: batchIds } });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await TimetableEntry.countDocuments(filter);
  const items = await TimetableEntry.find(filter)
    .populate("batch", "name")
    .sort({ dayOfWeek: 1, startTime: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

async function createEntry({ requester, payload }) {
  const fields = pickFields(payload, ["batchId", "dayOfWeek", "startTime", "endTime", "subject"]);
  const batchId = assertObjectId(fields.batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const dayOfWeek = assertEnum(fields.dayOfWeek, DAYS_OF_WEEK, "day of week");
  const startTime = assertString(fields.startTime, "start time", { maxLength: 10 });
  const endTime = assertString(fields.endTime, "end time", { maxLength: 10 });
  const subject = assertString(fields.subject, "subject", { maxLength: 200 });

  const entry = await TimetableEntry.create({
    batch: batchId,
    dayOfWeek,
    startTime,
    endTime,
    subject,
    createdBy: getUserId(requester),
  });

  return entry.populate("batch", "name");
}

async function updateEntry({ requester, entryId, payload }) {
  assertObjectId(entryId, "entry id");
  const entry = await TimetableEntry.findById(entryId);

  if (!entry) {
    throw new AppError("Timetable entry not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, entry.batch);

  const fields = pickFields(payload, ["dayOfWeek", "startTime", "endTime", "subject", "active"]);

  if (fields.dayOfWeek !== undefined) {
    entry.dayOfWeek = assertEnum(fields.dayOfWeek, DAYS_OF_WEEK, "day of week");
  }
  if (fields.startTime !== undefined) {
    entry.startTime = assertString(fields.startTime, "start time", { maxLength: 10 });
  }
  if (fields.endTime !== undefined) {
    entry.endTime = assertString(fields.endTime, "end time", { maxLength: 10 });
  }
  if (fields.subject !== undefined) {
    entry.subject = assertString(fields.subject, "subject", { maxLength: 200 });
  }
  if (fields.active !== undefined) {
    entry.active = fields.active === true;
    if (!entry.active) {
      entry.archivedAt = new Date();
    } else {
      entry.archivedAt = null;
    }
  }

  await entry.save();
  return entry.populate("batch", "name");
}

async function archiveEntry({ requester, entryId }) {
  assertObjectId(entryId, "entry id");
  const entry = await TimetableEntry.findById(entryId);

  if (!entry) {
    throw new AppError("Timetable entry not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, entry.batch);

  entry.active = false;
  entry.archivedAt = new Date();
  await entry.save();

  return { message: "Timetable entry archived successfully." };
}

module.exports = {
  listEntries,
  createEntry,
  updateEntry,
  archiveEntry,
};
