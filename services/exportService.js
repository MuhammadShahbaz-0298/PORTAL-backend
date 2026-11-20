// Builds Excel workbooks for users, attendance and submissions.
// Respects the same permission checks as the underlying list endpoints.

const ExcelJS = require("exceljs");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Submission = require("../models/Submission");
const { ROLES } = require("../constants");
const { getUserId, getUserRole } = require("../utils/authorization");
const batchAccessService = require("./batchAccessService");

async function toExcel(rows, fields, worksheetName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  worksheet.columns = fields.map((field) => ({
    header: field,
    key: field,
    width: Math.min(Math.max(field.length + 4, 16), 32),
  }));
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function exportUsers({ requester }) {
  const role = getUserRole(requester);
  let filter = { active: true };

  if (role === ROLES.TEACHER) {
    const batchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const enrollments = await require("../models/Enrollment")
      .find({ batch: { $in: batchIds }, active: { $ne: false } })
      .select("student")
      .lean();
    const studentIds = enrollments.map((e) => e.student);
    filter = { _id: { $in: studentIds }, active: true };
  }

  const users = await User.find(filter).select("name email role active createdAt").lean();
  const rows = users.map((u) => ({
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  }));

  return toExcel(rows, ["name", "email", "role", "active", "createdAt"], "Users");
}

async function exportAttendance({ requester, query }) {
  const role = getUserRole(requester);
  const filters = [];

  if (query.batchId) {
    filters.push({ batch: query.batchId });
  }

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  } else if (role === ROLES.STUDENT) {
    filters.push({ student: getUserId(requester) });
  }

  const filter = filters.length ? { $and: filters } : {};
  const records = await Attendance.find(filter)
    .populate("student", "name email")
    .populate("batch", "name")
    .lean();

  const rows = records.map((r) => ({
    student: r.student?.name || "",
    email: r.student?.email || "",
    batch: r.batch?.name || "",
    date: r.date,
    status: r.status,
    leaveReason: r.leaveReason || "",
  }));

  return toExcel(
    rows,
    ["student", "email", "batch", "date", "status", "leaveReason"],
    "Attendance",
  );
}

async function exportSubmissions({ requester, query }) {
  const role = getUserRole(requester);
  const filters = [];

  if (query.assignmentId) {
    filters.push({ assignment: query.assignmentId });
  }

  if (role === ROLES.STUDENT) {
    filters.push({ student: getUserId(requester) });
  } else if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  }

  const filter = filters.length ? { $and: filters } : {};
  const submissions = await Submission.find(filter)
    .populate("student", "name email")
    .populate("assignment", "title")
    .populate("batch", "name")
    .lean();

  const rows = submissions.map((s) => ({
    student: s.student?.name || "",
    email: s.student?.email || "",
    assignment: s.assignment?.title || "",
    batch: s.batch?.name || "",
    status: s.status,
    grade: s.grade || "",
    feedback: s.feedback || "",
    submittedAt: s.submittedAt,
  }));

  return toExcel(
    rows,
    ["student", "email", "assignment", "batch", "status", "grade", "feedback", "submittedAt"],
    "Submissions",
  );
}

module.exports = { exportUsers, exportAttendance, exportSubmissions };
