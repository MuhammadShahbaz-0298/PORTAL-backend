// Business logic for a na ly ti cs se rv ic e.
// Encapsulates feature rules and database access.
// Read-only analytics aggregations. Restricted to analytics.view permission.

const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const Batch = require("../models/Batch");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");

async function assertBatchAccess(requester, batchId) {
  const role = getUserRole(requester);
  if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, batchId);
  } else if (role === ROLES.STUDENT) {
    throw new AppError("Students cannot view batch analytics.", 403);
  }
}

async function batchAnalytics({ requester, batchId }) {
  assertObjectId(batchId, "batch id");
  await assertBatchAccess(requester, batchId);

  const batch = await Batch.findById(batchId).lean();
  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const totalStudents = await Enrollment.countDocuments({
    batch: batchId,
    active: { $ne: false },
  });

  // Submission rate: distinct students who submitted at least one assignment.
  const submissions = await Submission.find({ batch: batchId }).lean();
  const submittedStudentIds = new Set(submissions.map((s) => String(s.student)));
  const submissionRate =
    totalStudents > 0 ? Math.round((submittedStudentIds.size / totalStudents) * 100) : 0;

  // Attendance percentage.
  const attendanceRecords = await Attendance.find({ batch: batchId }).lean();
  const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
  const attendancePercentage =
    attendanceRecords.length > 0 ? Math.round((presentCount / attendanceRecords.length) * 100) : 0;

  return {
    batchId,
    batchName: batch.name,
    totalStudents,
    submissionRate,
    attendancePercentage,
    totalSubmissions: submissions.length,
    totalAttendanceRecords: attendanceRecords.length,
  };
}

async function overviewAnalytics({ requester }) {
  const role = getUserRole(requester);
  if (role === ROLES.STUDENT) {
    throw new AppError("Students cannot view overview analytics.", 403);
  }

  const totalUsers = await User.countDocuments({ active: true });
  const totalBatches = await Batch.countDocuments({ active: true });
  const totalSubmissions = await Submission.countDocuments({});
  const totalAttendance = await Attendance.countDocuments({});

  return {
    totalUsers,
    totalBatches,
    totalSubmissions,
    totalAttendance,
  };
}

module.exports = { batchAnalytics, overviewAnalytics };
