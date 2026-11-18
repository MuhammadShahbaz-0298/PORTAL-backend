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

async function runDetection() {
  const environment = loadEnvironment(process.env);
  await connectDB(environment.mongoUri);

  const attendanceThreshold = Number(process.env.AT_RISK_ATTENDANCE_THRESHOLD) || 70;
  const missedSubmissionThreshold = Number(process.env.AT_RISK_MISSED_SUBMISSIONS) || 2;

  const batches = await Batch.find({ active: true }).lean();

  for (const batch of batches) {
    const enrollments = await Enrollment.find({ batch: batch._id }).select("student").lean();
    const studentIds = enrollments.map((e) => e.student);

    const assignments = await Assignment.find({ batch: batch._id, active: true })
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
      if (missedSubmissions >= missedSubmissionThreshold) {
        reasons.push("missed_submissions");
      }

      if (reasons.length === 0) {
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
  await mongoose.disconnect();
}

if (require.main === module) {
  runDetection().catch((error) => {
    console.error("At-risk detection failed:", error.message);
    process.exit(1);
  });
}

module.exports = { runDetection };
