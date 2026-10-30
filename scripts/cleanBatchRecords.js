// Normalizes batches and enrollments and reports duplicate enrollments.
// Never deletes a row; duplicate student+batch pairs are printed only.

const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const { applyUpdate, cleanString, hasChanges, toObjectIdOrNull } = require("./cleanHelpers");

async function normalizeBatches({ apply, tracker }) {
  const batches = await Batch.find().lean();

  for (const batch of batches) {
    const update = {};
    const name = cleanString(batch.name);
    const teacher = toObjectIdOrNull(batch.teacher);

    if (name !== batch.name) {
      update.name = name;
    }

    if (teacher && String(teacher) !== String(batch.teacher)) {
      update.teacher = teacher;
    }

    if (typeof batch.active !== "boolean") {
      update.active = true;
    }

    if (batch.active === false && !batch.archivedAt) {
      update.archivedAt = new Date();
    }

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: Batch,
        filter: { _id: batch._id },
        update: { $set: update },
        label: "batches normalized",
        tracker,
      });
    }
  }
}

async function normalizeEnrollments({ apply, tracker }) {
  const enrollments = await Enrollment.find().lean();
  const groups = new Map();

  for (const enrollment of enrollments) {
    const student = toObjectIdOrNull(enrollment.student);
    const batch = toObjectIdOrNull(enrollment.batch);
    if (student && batch) {
      const key = `${student}:${batch}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of groups) {
    if (count > 1) {
      tracker.record("duplicate enrollments (reported, not deleted)");
      console.info(`  duplicate enrollment: ${key}`);
    }
  }

  for (const enrollment of enrollments) {
    const update = {};
    const student = toObjectIdOrNull(enrollment.student);
    const batch = toObjectIdOrNull(enrollment.batch);

    if (student && String(student) !== String(enrollment.student)) {
      update.student = student;
    }

    if (batch && String(batch) !== String(enrollment.batch)) {
      update.batch = batch;
    }

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: Enrollment,
        filter: { _id: enrollment._id },
        update: { $set: update },
        label: "enrollments normalized",
        tracker,
      });
    }
  }
}

module.exports = { normalizeBatches, normalizeEnrollments };
