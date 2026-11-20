// Find or idempotently create demo users, batches and enrollments.
// The seed entrypoint supplies obviously fake records and local credentials.

const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");

async function findOrCreateUser({ name, email, role, password }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return existingUser;
  }
  return User.create({ name, email, password, role, active: true });
}

async function findOrCreateBatch({ name, teacherId }) {
  return Batch.findOneAndUpdate(
    { name, teacher: teacherId },
    { $setOnInsert: { name, teacher: teacherId, active: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function findOrCreateEnrollment({ studentId, batchId }) {
  return Enrollment.findOneAndUpdate(
    { student: studentId, batch: batchId },
    {
      $set: { active: true, removedAt: null },
      $setOnInsert: { student: studentId, batch: batchId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

module.exports = { findOrCreateUser, findOrCreateBatch, findOrCreateEnrollment };
