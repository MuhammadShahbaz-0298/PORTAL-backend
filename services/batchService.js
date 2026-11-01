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
const { buildSearchFilter } = require("../utils/search");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

async function listBatches({ requester, query }) {
  const pagination = getPagination(query);
  const searchFilter = buildSearchFilter(query.search, ["name"]);
  const filters = [{ active: true }, searchFilter];
  const role = getUserRole(requester);

  if (role === ROLES.TEACHER) {
    filters.push({ teacher: getUserId(requester) });
  }

  if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ _id: { $in: batchIds } });
  }

  const filter = { $and: filters };
  const total = await Batch.countDocuments(filter);
  const batches = await Batch.find(filter)
    .populate("teacher", "name email")
    .sort({ name: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  const items = [];

  for (const batch of batches) {
    const value = batch.toObject();
    value.studentCount = await Enrollment.countDocuments({ batch: value._id });
    items.push(value);
  }

  return { items, pagination, total };
}

async function getBatchStudents({ requester, batchId, query }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const pagination = getPagination(query);
  const total = await Enrollment.countDocuments({ batch: batchId });
  const enrollments = await Enrollment.find({ batch: batchId })
    .populate("student", "name email role active")
    .sort({ createdAt: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  const students = enrollments.map((enrollment) => enrollment.student).filter(Boolean);
  return { items: students, pagination, total };
}

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

async function enrollStudent({ requester, batchId, payload }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const studentId = assertObjectId(payload.studentId, "student id");
  const batch = await Batch.findOne({ _id: batchId, active: true });

  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const student = await User.findOne({ _id: studentId, role: ROLES.STUDENT, active: true });
  if (!student) {
    throw new AppError("Student not found.", 404);
  }

  // A student may belong to several batches. We do not delete other enrollments.
  const enrollment = await Enrollment.findOneAndUpdate(
    { student: studentId, batch: batchId },
    { student: studentId, batch: batchId },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return enrollment;
}

module.exports = {
  listBatches,
  getBatchStudents,
  createBatch,
  updateBatch,
  archiveBatch,
  deleteBatch,
  enrollStudent,
};
