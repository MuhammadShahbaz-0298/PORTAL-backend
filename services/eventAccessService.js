// Resolve event audiences and enforce event ownership.
// Teachers may only manage events associated with active batches they own.

const Event = require("../models/Event");
const Enrollment = require("../models/Enrollment");
const Batch = require("../models/Batch");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole, isAdmin } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");

async function getStudentBatchIds(studentId) {
  const enrollments = await Enrollment.find({
    student: studentId,
    active: { $ne: false },
  })
    .select("batch")
    .lean();
  return enrollments.map((enrollment) => enrollment.batch);
}

async function getTeacherBatchIds(teacherId) {
  const batches = await Batch.find({ teacher: teacherId, active: true }).select("_id").lean();
  return batches.map((batch) => batch._id);
}

async function assertCanManageBatch(requester, batchId) {
  if (!batchId) return;
  assertObjectId(String(batchId), "batch id");
  const role = getUserRole(requester);
  if (isAdmin(requester) || role === ROLES.ADMIN) return;
  if (role !== ROLES.TEACHER) throw new AppError("You cannot manage events.", 403);
  const batch = await Batch.findOne({ _id: batchId, active: true }).select("teacher").lean();
  if (!batch) throw new AppError("Batch not found.", 404);
  if (String(batch.teacher) !== getUserId(requester)) {
    throw new AppError("You can only manage events for your own batches.", 403);
  }
}

async function assertCanManageEvent(requester, eventId) {
  assertObjectId(eventId, "event id");
  const event = await Event.findById(eventId);
  if (!event || !event.active) throw new AppError("Event not found.", 404);
  if (isAdmin(requester)) return event;
  if (getUserRole(requester) !== ROLES.TEACHER) {
    throw new AppError("You cannot manage this event.", 403);
  }
  if (!event.batch) throw new AppError("Only administrators can manage school-wide events.", 403);
  const batch = await Batch.findById(event.batch).select("teacher").lean();
  if (!batch || String(batch.teacher) !== getUserId(requester)) {
    throw new AppError("You can only manage events for your own batches.", 403);
  }
  return event;
}

module.exports = {
  getStudentBatchIds,
  getTeacherBatchIds,
  assertCanManageBatch,
  assertCanManageEvent,
};
