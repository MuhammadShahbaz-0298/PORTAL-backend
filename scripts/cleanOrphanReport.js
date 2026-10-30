// Reports references that point at records which no longer exist.
// This file never repairs or deletes anything; a human decides what to do.

const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Attendance = require("../models/Attendance");
const Submission = require("../models/Submission");

function reportMissingReferences({ label, records, field, validIds, tracker }) {
  for (const record of records) {
    const value = record[field];
    if (value && !validIds.has(String(value))) {
      tracker.record(label);
      console.info(`  orphan ${label}: ${record._id} -> ${value}`);
    }
  }
}

async function reportOrphans({ tracker }) {
  const userIds = new Set((await User.find().select("_id").lean()).map((user) => String(user._id)));
  const batchIds = new Set(
    (await Batch.find().select("_id").lean()).map((batch) => String(batch._id)),
  );
  const assignmentIds = new Set(
    (await Assignment.find().select("_id").lean()).map((assignment) => String(assignment._id)),
  );

  const batches = await Batch.find().lean();
  const enrollments = await Enrollment.find().lean();
  const assignments = await Assignment.find().lean();
  const attendance = await Attendance.find().lean();
  const submissions = await Submission.find().lean();

  reportMissingReferences({
    label: "batches with missing teacher",
    records: batches,
    field: "teacher",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "enrollments with missing student",
    records: enrollments,
    field: "student",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "enrollments with missing batch",
    records: enrollments,
    field: "batch",
    validIds: batchIds,
    tracker,
  });
  reportMissingReferences({
    label: "assignments with missing batch",
    records: assignments,
    field: "batch",
    validIds: batchIds,
    tracker,
  });
  reportMissingReferences({
    label: "assignments with missing creator",
    records: assignments,
    field: "createdBy",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "attendance with missing student",
    records: attendance,
    field: "student",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "attendance with missing batch",
    records: attendance,
    field: "batch",
    validIds: batchIds,
    tracker,
  });
  reportMissingReferences({
    label: "attendance with missing author",
    records: attendance,
    field: "enteredBy",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "submissions with missing assignment",
    records: submissions,
    field: "assignment",
    validIds: assignmentIds,
    tracker,
  });
  reportMissingReferences({
    label: "submissions with missing student",
    records: submissions,
    field: "student",
    validIds: userIds,
    tracker,
  });
  reportMissingReferences({
    label: "submissions with missing batch",
    records: submissions,
    field: "batch",
    validIds: batchIds,
    tracker,
  });
  reportMissingReferences({
    label: "submissions with missing grader",
    records: submissions,
    field: "gradedBy",
    validIds: userIds,
    tracker,
  });
}

module.exports = { reportMissingReferences, reportOrphans };
