// Database work for batches, enrollments and batch student lists.
// Batches are archived, never hard-deleted, so history stays intact.

const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { ROLES, BATCH_NAME_MAX_LENGTH } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId, assertString, pickFields } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");
const batchReadService = require("./batchReadService");

async function resolveTeacherId(requester, teacherId) {
  const role = getUserRole(requester);

  if (role === ROLES.TEACHER) {
    return getUserId(requester);
  }

  assertObjectId(teacherId, "teacher id");
  const teacher = await User.findOne({ _id: teacherId, role: ROLES.TEACHER, active: true });

  if (!teacher) {
    throw new AppError("Teacher not found.", 404);
  }

  return teacher._id;
}

async function createBatch({ requester, payload }) {
  const fields = pickFields(payload, ["name", "teacherId"]);
  const name = assertString(fields.name, "name", { maxLength: BATCH_NAME_MAX_LENGTH });
  const teacher = await resolveTeacherId(requester, fields.teacherId);
  const batch = await Batch.create({ name, teacher });
  return batch.populate("teacher", "name email");
}

async function updateBatch({ requester, batchId, payload }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const fields = pickFields(payload, ["name", "teacherId"]);

  if (fields.name !== undefined) {
    batch.name = assertString(fields.name, "name", { maxLength: BATCH_NAME_MAX_LENGTH });
  }

  if (fields.teacherId !== undefined) {
    batch.teacher = await resolveTeacherId(requester, fields.teacherId);
  }

  await batch.save();
  return batch.populate("teacher", "name email");
}

async function archiveBatch({ requester, batchId }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  batch.active = false;
  batch.archivedAt = new Date();
  await batch.save();

  return { message: "Batch archived successfully." };
}

async function deleteBatch({ requester, batchId }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const batch = await Batch.findById(batchId);
  if (!batch) throw new AppError("Batch not found.", 404);

  const references = await Promise.all([
    Enrollment.exists({ batch: batch._id }),
    Attendance.exists({ batch: batch._id }),
    Assignment.exists({ batch: batch._id }),
    Submission.exists({ batch: batch._id }),
  ]);
  if (references.some(Boolean)) {
    throw new AppError("This batch has linked history or assignments. Archive it instead.", 409);
  }

  await batch.deleteOne();
  return { message: "Batch deleted permanently." };
}

module.exports = {
  createBatch,
  updateBatch,
  archiveBatch,
  deleteBatch,
  ...batchReadService,
};
