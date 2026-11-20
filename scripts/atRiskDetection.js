// At-risk detection job.
// Flags students whose attendance is below a threshold AND who have missed
// more than a configurable number of submissions.
// Thresholds come from env vars, never hardcoded.
// Results are written to the RiskFlag collection, not emailed.

require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { loadEnvironment } = require("../config/env");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const Assignment = require("../models/Assignment");
const RiskFlag = require("../models/RiskFlag");

async function runDetection(settings = {}) {
  const attendanceThreshold = settings.attendanceThreshold;
  const missedSubmissionThreshold = settings.missedSubmissionThreshold;

  if (!Number.isFinite(attendanceThreshold) || !Number.isInteger(missedSubmissionThreshold)) {
    throw new Error("At-risk detection thresholds must be provided by environment variables.");
  }

  const batches = await Batch.find({ active: true }).lean();
  const now = new Date();

  for (const batch of batches) {
    const enrollments = await Enrollment.find({
      batch: batch._id,
      active: { $ne: false },
    })
      .select("student")
      .lean();
    const studentIds = enrollments.map((e) => e.student);

    const assignments = await Assignment.find({
      batch: batch._id,
      active: true,
      dueDate: { $lte: now },
    })
      .select("_id")
      .lean();
    const assignmentIds = assignments.map((a) => a._id);

    for (const studentId of studentIds) {
      // Attendance percentage.
      const attendanceRecords = await Attendance.find({
        student: studentId,
        batch: batch._id,
      }).lean();
      const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
      const attendancePercentage =
        attendanceRecords.length > 0
          ? Math.round((presentCount / attendanceRecords.length) * 100)
          : 100;

      // Missed submissions: assignments with no submission.
      const submissions = await Submission.find({
        student: studentId,
        batch: batch._id,
      })
        .select("assignment")
        .lean();
      const submittedAssignmentIds = new Set(submissions.map((s) => String(s.assignment)));
      const missedSubmissions = assignmentIds.filter(
        (id) => !submittedAssignmentIds.has(String(id)),
      ).length;

      const reasons = [];
      if (attendancePercentage < attendanceThreshold) {
        reasons.push("low_attendance");
      }
      if (missedSubmissions > missedSubmissionThreshold) {
        reasons.push("missed_submissions");
      }

      if (reasons.length === 0) {
        await RiskFlag.updateMany(
          { student: studentId, batch: batch._id, status: "open" },
          { $set: { status: "resolved", resolvedAt: now } },
        );
        continue;
      }

      // Upsert an open risk flag.
      await RiskFlag.findOneAndUpdate(
        { student: studentId, batch: batch._id, status: "open" },
        {
          student: studentId,
          batch: batch._id,
          reasons,
          attendancePercentage,
          missedSubmissions,
          status: "open",
        },
        { upsert: true, new: true },
      );
    }
  }

  console.info("At-risk detection complete.");
}

if (require.main === module) {
  const environment = loadEnvironment(process.env);
  connectDB(environment.mongoUri)
    .then(() => runDetection(environment.atRisk))
    .catch((error) => {
      console.error("At-risk detection failed:", error.message);
      process.exit(1);
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { runDetection };
