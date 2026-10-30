// Normalizes assignment records: references, dates, numbers and archive flags.

const Assignment = require("../models/Assignment");
const {
  applyUpdate,
  cleanString,
  hasChanges,
  toDateOrNull,
  toNumberOrNull,
  toObjectIdOrNull,
} = require("./cleanHelpers");

async function normalizeAssignments({ apply, tracker }) {
  const assignments = await Assignment.find().lean();

  for (const assignment of assignments) {
    const update = {};
    const batch = toObjectIdOrNull(assignment.batch);
    const createdBy = toObjectIdOrNull(assignment.createdBy);
    const dueDate = toDateOrNull(assignment.dueDate);
    const maxFileSizeMb = toNumberOrNull(assignment.maxFileSizeMb);
    const title = cleanString(assignment.title);

    if (batch && String(batch) !== String(assignment.batch)) {
      update.batch = batch;
    }

    if (createdBy && String(createdBy) !== String(assignment.createdBy)) {
      update.createdBy = createdBy;
    }

    if (dueDate && String(dueDate) !== String(assignment.dueDate)) {
      update.dueDate = dueDate;
    }

    if (maxFileSizeMb !== null && maxFileSizeMb !== assignment.maxFileSizeMb) {
      update.maxFileSizeMb = maxFileSizeMb;
    }

    if (title !== assignment.title) {
      update.title = title;
    }

    if (typeof assignment.active !== "boolean") {
      update.active = true;
    }

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: Assignment,
        filter: { _id: assignment._id },
        update: { $set: update },
        label: "assignments normalized",
        tracker,
      });
    }
  }
}

module.exports = { normalizeAssignments };
