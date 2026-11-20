// Database work for calendar events.
// Teachers may manage events only for their own batches.

const Event = require("../models/Event");
const { ROLES, EVENT_TITLE_MAX_LENGTH, EVENT_DESCRIPTION_MAX_LENGTH } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const { assertString, pickFields } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const eventAccessService = require("./eventAccessService");

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} must be a valid date.`, 400);
  return date;
}

async function listEvents({ requester, query }) {
  const pagination = getPagination(query);
  const role = getUserRole(requester);
  const userId = getUserId(requester);
  const filter = { active: true };

  if (role === ROLES.STUDENT) {
    const batchIds = await eventAccessService.getStudentBatchIds(userId);
    filter.$or = [{ batch: null }, { batch: { $in: batchIds } }];
  } else if (role === ROLES.TEACHER) {
    const ownBatchIds = await eventAccessService.getTeacherBatchIds(userId);
    filter.$or = [{ batch: null }, { batch: { $in: ownBatchIds } }];
  }

  const total = await Event.countDocuments(filter);
  const items = await Event.find(filter)
    .populate("batch", "name")
    .populate("createdBy", "name role")
    .sort({ date: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();
  return { items, pagination, total };
}

async function createEvent({ requester, payload }) {
  const fields = pickFields(payload, ["title", "description", "date", "endDate", "batchId"]);
  const title = assertString(fields.title, "title", { maxLength: EVENT_TITLE_MAX_LENGTH });
  const description =
    fields.description === null || fields.description === undefined
      ? ""
      : assertString(fields.description, "description", {
          maxLength: EVENT_DESCRIPTION_MAX_LENGTH,
          allowEmpty: true,
        });
  const date = parseDate(fields.date, "date");
  let endDate = null;
  if (fields.endDate) {
    endDate = parseDate(fields.endDate, "end date");
    if (endDate < date) throw new AppError("End date must be on or after the start date.", 400);
  }
  let batch = null;
  if (fields.batchId) {
    await eventAccessService.assertCanManageBatch(requester, fields.batchId);
    batch = fields.batchId;
  } else if (getUserRole(requester) === ROLES.TEACHER) {
    // Teachers must target one of their own batches; school-wide is admin-only.
    throw new AppError("Teachers must select one of their own batches.", 400);
  }
  const event = await Event.create({
    title,
    description,
    date,
    endDate,
    batch,
    createdBy: getUserId(requester),
  });
  return event;
}

async function updateEvent({ requester, eventId, payload }) {
  const event = await eventAccessService.assertCanManageEvent(requester, eventId);
  const fields = pickFields(payload, ["title", "description", "date", "endDate", "batchId"]);
  if (fields.title !== undefined) {
    event.title = assertString(fields.title, "title", { maxLength: EVENT_TITLE_MAX_LENGTH });
  }
  if (fields.description !== undefined) {
    event.description =
      fields.description === null
        ? ""
        : assertString(fields.description, "description", {
            maxLength: EVENT_DESCRIPTION_MAX_LENGTH,
            allowEmpty: true,
          });
  }
  if (fields.date !== undefined) event.date = parseDate(fields.date, "date");
  if (fields.endDate !== undefined) {
    event.endDate = fields.endDate ? parseDate(fields.endDate, "end date") : null;
  }
  if (event.endDate && event.endDate < event.date)
    throw new AppError("End date must be on or after the start date.", 400);
  if (fields.batchId !== undefined) {
    if (fields.batchId) {
      await eventAccessService.assertCanManageBatch(requester, fields.batchId);
      event.batch = fields.batchId;
    } else {
      if (!isAdmin(requester))
        throw new AppError("Only administrators can create school-wide events.", 403);
      event.batch = null;
    }
  }
  await event.save();
  return event;
}

async function archiveEvent({ requester, eventId }) {
  const event = await eventAccessService.assertCanManageEvent(requester, eventId);
  event.active = false;
  event.archivedAt = new Date();
  await event.save();
  return { message: "Event archived successfully." };
}

module.exports = { listEvents, createEvent, updateEvent, archiveEvent };
