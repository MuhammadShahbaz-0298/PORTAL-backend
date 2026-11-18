// Computes a student's weighted score from existing Submission and Attendance records.
// No existing grade storage is changed; this is a read-only computation.

const Batch = require("../models/Batch");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");

async function computeWeightedScore({ requester, studentId, batchId }) {
  assertObjectId(studentId, "student id");
  assertObjectId(batchId, "batch id");

  const role = getUserRole(requester);
  const userId = getUserId(requester);

  // Ownership / access check.
  if (role === ROLES.STUDENT && userId !== studentId) {
    throw new AppError("You cannot view another student's score.", 403);
  }
  if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, batchId);
  }
  if (role === "guardian") {
    const guardianService = require("./guardianService");
    await guardianService.assertCanViewChild(requester, studentId);
  }

  const batch = await Batch.findById(batchId).lean();
  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const weights = batch.gradeWeights || [];
  if (weights.length === 0) {
    return { studentId, batchId, weightedScore: null, message: "No grade weights configured." };
  }

  // Collect component scores from existing records.
  const componentScores = {};

  // Assignment component from submission grades.
  const submissions = await Submission.find({ student: studentId, batch: batchId }).lean();
  const numericGrades = submissions
    .map((s) => (s.grade ? Number(s.grade) : null))
    .filter((g) => Number.isFinite(g));
  const assignmentAverage =
    numericGrades.length > 0
      ? numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length
      : 0;
  componentScores.assignments = assignmentAverage;

  // Attendance component from attendance records.
  const attendanceRecords = await Attendance.find({ student: studentId, batch: batchId }).lean();
  const presentCount = attendanceRecords.filter((r) => r.status === "present").length;
  const attendancePercentage =
    attendanceRecords.length > 0 ? (presentCount / attendanceRecords.length) * 100 : 0;
  componentScores.attendance = attendancePercentage;

  // Compute weighted total.
  let totalWeight = 0;
  let weightedSum = 0;
  for (const weight of weights) {
    const score = componentScores[weight.component.toLowerCase()] || 0;
    weightedSum += score * (weight.weight || 0);
    totalWeight += weight.weight || 0;
  }

  const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    studentId,
    batchId,
    weightedScore: Math.round(weightedScore * 100) / 100,
    components: componentScores,
    weights,
  };
}

module.exports = { computeWeightedScore };
