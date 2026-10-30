// Normalizes submission records and reports duplicate student+assignment rows.

const Submission = require("../models/Submission");
const {
  applyUpdate,
  hasChanges,
  toDateOrNull,
  toNumberOrNull,
  toObjectIdOrNull,
} = require("./cleanHelpers");

async function normalizeSubmissions({ apply, tracker }) {
  const submissions = await Submission.find().lean();
  const groups = new Map();

  for (const submission of submissions) {
    const assignment = toObjectIdOrNull(submission.assignment);
    const student = toObjectIdOrNull(submission.student);
    if (assignment && student) {
      const key = `${assignment}:${student}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of groups) {
    if (count > 1) {
      tracker.record("duplicate submissions (reported, not deleted)");
      console.info(`  duplicate submission: ${key}`);
    }
  }

  for (const submission of submissions) {
    const update = {};
    const assignment = toObjectIdOrNull(submission.assignment);
    const student = toObjectIdOrNull(submission.student);
    const batch = toObjectIdOrNull(submission.batch);
    const gradedBy = toObjectIdOrNull(submission.gradedBy);
    const fileSize = toNumberOrNull(submission.fileSize);
    const submittedAt = toDateOrNull(submission.submittedAt);
    const gradedAt = toDateOrNull(submission.gradedAt);
    const status = String(submission.status || "")
      .trim()
      .toLowerCase();

    if (assignment && String(assignment) !== String(submission.assignment)) {
      update.assignment = assignment;
    }
    if (student && String(student) !== String(submission.student)) update.student = student;
    if (batch && String(batch) !== String(submission.batch)) update.batch = batch;
    if (gradedBy && String(gradedBy) !== String(submission.gradedBy)) update.gradedBy = gradedBy;
    if (fileSize !== null && fileSize !== submission.fileSize) update.fileSize = fileSize;
    if (submittedAt && String(submittedAt) !== String(submission.submittedAt)) {
      update.submittedAt = submittedAt;
    }
    if (gradedAt && String(gradedAt) !== String(submission.gradedAt)) update.gradedAt = gradedAt;
    if (status && status !== submission.status) update.status = status;
    if (typeof submission.grade === "number") update.grade = String(submission.grade);

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: Submission,
        filter: { _id: submission._id },
        update: { $set: update },
        label: "submissions normalized",
        tracker,
      });
    }
  }
}

module.exports = { normalizeSubmissions };
