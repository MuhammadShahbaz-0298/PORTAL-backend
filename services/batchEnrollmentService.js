// Database work for student enrollment in batches.
// Removed enrollments stay archived and can be reactivated without losing history.

const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { assertObjectId } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");

async function enrollStudent({ requester, batchId, payload }) {
  assertObjectId(batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);
  const studentId = assertObjectId(payload.studentId, "student id");

  const [batch, student] = await Promise.all([
    Batch.findOne({ _id: batchId, active: true }),
    User.findOne({ _id: studentId, role: ROLES.STUDENT, active: true }),
  ]);
  if (!batch) throw new AppError("Batch not found.", 404);
  if (!student) throw new AppError("Student not found.", 404);

  return Enrollment.findOneAndUpdate(
    { student: studentId, batch: batchId },
    {
      $set: { active: true, removedAt: null },
      $setOnInsert: { student: studentId, batch: batchId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function unenrollStudent({ requester, batchId, studentId }) {
  assertObjectId(batchId, "batch id");
  assertObjectId(studentId, "student id");
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const enrollment = await Enrollment.findOne({
    batch: batchId,
    student: studentId,
    active: { $ne: false },
  });
  if (!enrollment) throw new AppError("Student is not enrolled in this batch.", 404);

  enrollment.active = false;
  enrollment.removedAt = new Date();
  await enrollment.save();
  return { message: "Student removed from this batch." };
}

module.exports = { enrollStudent, unenrollStudent };
