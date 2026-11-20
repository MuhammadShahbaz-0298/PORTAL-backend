// Generates a PDF report card for one student in one batch.
// Template fields (school name, logo path) come from env vars, not hardcoded.

const PDFDocument = require("pdfkit");
const User = require("../models/User");
const Batch = require("../models/Batch");
const Enrollment = require("../models/Enrollment");
const Submission = require("../models/Submission");
const Attendance = require("../models/Attendance");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const batchAccessService = require("./batchAccessService");

async function resolveBatchId(userId, batchId) {
  if (batchId) {
    assertObjectId(batchId, "batch id");
    return batchId;
  }
  const enrollments = await Enrollment.find({
    student: userId,
    active: { $ne: false },
  })
    .select("batch")
    .lean();
  const batchIds = [...new Set(enrollments.map((e) => String(e.batch)).filter(Boolean))];
  if (batchIds.length === 1) return batchIds[0];
  if (batchIds.length === 0) {
    throw new AppError("This student is not enrolled in an active batch.", 400);
  }
  throw new AppError("Specify batchId. This student belongs to multiple active batches.", 400);
}

async function buildReportCard({ requester, userId, batchId }) {
  assertObjectId(userId, "user id");

  const role = getUserRole(requester);
  const requesterId = getUserId(requester);

  if (role === ROLES.STUDENT && requesterId !== userId) {
    throw new AppError("You cannot view another student's report card.", 403);
  }

  const resolvedBatchId = await resolveBatchId(userId, batchId);

  if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, resolvedBatchId);
  } else if (role === ROLES.STUDENT) {
    await batchAccessService.assertCanAccessBatch(requester, resolvedBatchId);
  }

  const student = await User.findById(userId).select("name email role").lean();
  if (!student) {
    throw new AppError("Student not found.", 404);
  }

  const batch = await Batch.findById(resolvedBatchId).lean();
  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const submissions = await Submission.find({ student: userId, batch: resolvedBatchId }).lean();
  const attendance = await Attendance.find({ student: userId, batch: resolvedBatchId }).lean();

  const schoolName = process.env.REPORT_CARD_SCHOOL_NAME || "School Portal";

  // Build the PDF in memory and return as a buffer.
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).text(schoolName, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text("Report Card", { align: "center" });
    doc.moveDown(1);

    // Student info
    doc.fontSize(12).text(`Student: ${student.name}`);
    doc.text(`Email: ${student.email}`);
    doc.text(`Batch: ${batch.name}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown(1);

    // Grades
    doc.fontSize(13).text("Grades", { underline: true });
    doc.moveDown(0.5);
    if (submissions.length === 0) {
      doc.fontSize(11).text("No submissions recorded.");
    } else {
      for (const submission of submissions) {
        doc
          .fontSize(11)
          .text(
            `Grade: ${submission.grade || "N/A"} | Status: ${submission.status} | Submitted: ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : "N/A"}`,
          );
      }
    }
    doc.moveDown(1);

    // Attendance
    doc.fontSize(13).text("Attendance", { underline: true });
    doc.moveDown(0.5);
    const presentCount = attendance.filter((r) => r.status === "present").length;
    const total = attendance.length;
    doc.fontSize(11).text(`Present: ${presentCount} / ${total}`);
    doc.text(`Percentage: ${total ? Math.round((presentCount / total) * 100) : 0}%`);

    doc.end();
  });
}

module.exports = { buildReportCard };
