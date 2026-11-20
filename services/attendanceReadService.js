// Read and summarize attendance records.
// Student and teacher results are limited to records they are allowed to see.

const Attendance = require("../models/Attendance");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertDate, assertObjectId, assertOptionalString } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

function startOfDay(value) {
  const date = assertDate(value, "date");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addOneDay(date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

async function listAttendance({ requester, query }) {
  const pagination = getPagination(query);
  const filters = [];
  const role = getUserRole(requester);
  const batchId = assertOptionalString(query.batchId, "batchId", { maxLength: 50 });
  const studentId = assertOptionalString(query.studentId, "studentId", { maxLength: 50 });
  const dateValue = assertOptionalString(query.date, "date", { maxLength: 50 });

  if (batchId) {
    filters.push({ batch: assertObjectId(batchId, "batchId") });
  }

  if (studentId) {
    filters.push({ student: assertObjectId(studentId, "studentId") });
  }

  if (dateValue) {
    const dayStart = startOfDay(dateValue);
    filters.push({ date: { $gte: dayStart, $lt: addOneDay(dayStart) } });
  }

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    const allowedBatchIds = batchId
      ? ownedBatchIds.filter((id) => String(id) === batchId)
      : ownedBatchIds;
    filters.push({ batch: { $in: allowedBatchIds } });
  }

  if (role === ROLES.STUDENT) {
    if (studentId && studentId !== getUserId(requester)) {
      throw new AppError("You cannot view another student's attendance.", 403);
    }
    filters.push({ student: getUserId(requester) });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await Attendance.countDocuments(filter);
  const items = await Attendance.find(filter)
    .populate("student", "name email")
    .populate("batch", "name")
    .sort({ date: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

async function getAttendanceSummary({ requester, studentId }) {
  assertObjectId(studentId, "student id");
  const role = getUserRole(requester);
  const filters = [{ student: studentId }];

  if (role === ROLES.STUDENT && studentId !== getUserId(requester)) {
    throw new AppError("You cannot view another student's attendance.", 403);
  }

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  }

  const records = await Attendance.find({ $and: filters })
    .populate("student", "name email")
    .populate("batch", "name")
    .sort({ date: -1 });

  const presentCount = records.filter((record) => record.status === "present").length;
  const total = records.length;

  return {
    studentId,
    present: presentCount,
    total,
    percentage: total ? Math.round((presentCount / total) * 100) : 0,
    records,
  };
}

module.exports = { startOfDay, listAttendance, getAttendanceSummary };
