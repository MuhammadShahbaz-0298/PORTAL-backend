// Normalizes attendance records and reports duplicate student+batch+day rows.

const Attendance = require("../models/Attendance");
const { applyUpdate, hasChanges, toDateOrNull, toObjectIdOrNull } = require("./cleanHelpers");

async function normalizeAttendance({ apply, tracker }) {
  const records = await Attendance.find().lean();
  const groups = new Map();

  for (const record of records) {
    const student = toObjectIdOrNull(record.student);
    const batch = toObjectIdOrNull(record.batch);
    const date = toDateOrNull(record.date);
    if (student && batch && date) {
      const day = date.toISOString().slice(0, 10);
      const key = `${student}:${batch}:${day}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of groups) {
    if (count > 1) {
      tracker.record("duplicate attendance days (reported, not deleted)");
      console.info(`  duplicate attendance: ${key}`);
    }
  }

  for (const record of records) {
    const update = {};
    const student = toObjectIdOrNull(record.student);
    const batch = toObjectIdOrNull(record.batch);
    const enteredBy = toObjectIdOrNull(record.enteredBy);
    const date = toDateOrNull(record.date);
    const status = String(record.status || "")
      .trim()
      .toLowerCase();

    if (student && String(student) !== String(record.student)) update.student = student;
    if (batch && String(batch) !== String(record.batch)) update.batch = batch;
    if (enteredBy && String(enteredBy) !== String(record.enteredBy)) update.enteredBy = enteredBy;

    if (date) {
      const dayStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      if (String(dayStart) !== String(record.date)) update.date = dayStart;
    }

    if (status && status !== record.status) update.status = status;
    if (typeof record.batchName === "string" && record.batchName !== record.batchName.trim()) {
      update.batchName = record.batchName.trim();
    }

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: Attendance,
        filter: { _id: record._id },
        update: { $set: update },
        label: "attendance normalized",
        tracker,
      });
    }
  }
}

module.exports = { normalizeAttendance };
