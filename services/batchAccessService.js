// One place that answers: may this user touch this batch?
// Admin may touch all batches. A teacher may touch only batches they own.

const mongoose = require("mongoose");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");

async function canManageBatch(user, batchId) {
  if (!mongoose.isValidObjectId(batchId)) {
    return false;
  }

  if (getUserRole(user) === ROLES.ADMIN) {
    return true;
  }

  if (getUserRole(user) !== ROLES.TEACHER) {
    return false;
  }

  return Boolean(
    await Batch.exists({
      _id: batchId,
      teacher: getUserId(user),
      active: true,
    }),
  );
}

async function assertCanManageBatch(user, batchId) {
  const allowed = await canManageBatch(user, batchId);

  if (!allowed) {
    throw new AppError("You do not have access to this batch.", 403);
  }
}

async function assertCanAccessBatch(user, batchId) {
  if (await canManageBatch(user, batchId)) {
    return;
  }

  if (getUserRole(user) === ROLES.STUDENT) {
    const enrollmentExists = await Enrollment.exists({
      student: getUserId(user),
      batch: batchId,
    });

    if (enrollmentExists) {
      return;
    }
  }

  throw new AppError("You do not have access to this batch.", 403);
}

async function getTeacherBatchIds(userId) {
  const batches = await Batch.find({ teacher: userId, active: true }).select("_id").lean();
  return batches.map((batch) => batch._id);
}

async function getStudentBatchIds(userId) {
  const enrollments = await Enrollment.find({ student: userId }).select("batch").lean();
  return enrollments.map((enrollment) => enrollment.batch);
}

async function assertStudentEnrolled(studentId, batchId) {
  const enrollmentExists = await Enrollment.exists({ student: studentId, batch: batchId });

  if (!enrollmentExists) {
    throw new AppError("Student is not enrolled in this batch.", 400);
  }
}

module.exports = {
  canManageBatch,
  assertCanManageBatch,
  assertCanAccessBatch,
  getTeacherBatchIds,
  getStudentBatchIds,
  assertStudentEnrolled,
};
