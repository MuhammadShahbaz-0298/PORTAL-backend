// Database work for attendance.
// Teachers can only read or write attendance for batches they own.

const Attendance = require("../models/Attendance");
const Batch = require("../models/Batch");
const { ATTENDANCE_STATUSES, FEEDBACK_MAX_LENGTH, ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const {
  assertDate,
  assertEnum,
  assertNumber,
  assertString,
  assertObjectId,
  assertOptionalString,
  pickFields,
} = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

function startOfDay(value) {
  const date = assertDate(value, "date");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addOneDay(date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

async function addAttendance({ requester, payload }) {
  const fields = pickFields(payload, [
    "studentId",
    "batchId",
    "date",
    "status",
    "leaveReason",
    "timezoneOffset",
  ]);
  const studentId = assertObjectId(fields.studentId, "student id");
  const batchId = assertObjectId(fields.batchId, "batch id");
  const date = startOfDay(fields.date);
  const timezoneOffset =
    fields.timezoneOffset === undefined
      ? 0
      : assertNumber(fields.timezoneOffset, "timezoneOffset", {
          min: -840,
          max: 720,
          integer: true,
        });
  const today = startOfDay(new Date(Date.now() - timezoneOffset * 60 * 1000));
  if (date > today) {
    throw new AppError("Attendance cannot be marked for a future date.", 400);
  }
  const status = assertEnum(fields.status, ATTENDANCE_STATUSES, "status");

  await batchAccessService.assertCanManageBatch(requester, batchId);
  await batchAccessService.assertStudentEnrolled(studentId, batchId);
  const batch = await Batch.findOne({ _id: batchId, active: true }).select("name");

  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  const update = {
    $set: {
      status,
      enteredBy: getUserId(requester),
      batchName: batch.name,
    },
    $setOnInsert: { student: studentId, batch: batchId, date },
  };

  if (status === "leave") {
    const leaveReason = assertString(fields.leaveReason, "leave reason", {
      maxLength: FEEDBACK_MAX_LENGTH,
    });
    if (!leaveReason.trim()) {
      throw new AppError("leave reason is required.", 400);
    }
    update.$set.leaveReason = leaveReason;
  } else {
    if (
      fields.leaveReason !== undefined &&
      fields.leaveReason !== null &&
      String(fields.leaveReason).trim() !== ""
    ) {
      throw new AppError("leave reason is only allowed when status is leave.", 400);
    }
    update.$unset = { leaveReason: "" };
  }

  return Attendance.findOneAndUpdate(
    { student: studentId, batch: batchId, date },
    update,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
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

async function updateAttendance({ requester, attendanceId, payload }) {
  assertObjectId(attendanceId, "attendance id");
  const attendance = await Attendance.findById(attendanceId);

  if (!attendance) {
    throw new AppError("Attendance record not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, attendance.batch);
  const fields = pickFields(payload, ["date", "status", "leaveReason", "timezoneOffset"]);
  const timezoneOffset =
    fields.timezoneOffset === undefined
      ? 0
      : assertNumber(fields.timezoneOffset, "timezoneOffset", {
          min: -840,
          max: 720,
          integer: true,
        });

  if (fields.date !== undefined) {
    attendance.date = startOfDay(fields.date);
  }

  if (
    getUserRole(requester) === ROLES.TEACHER &&
    attendance.date > startOfDay(new Date(Date.now() - timezoneOffset * 60 * 1000))
  ) {
    throw new AppError("Attendance cannot be marked for a future date.", 400);
  }

  if (fields.status !== undefined) {
    attendance.status = assertEnum(fields.status, ATTENDANCE_STATUSES, "status");
  }

  if (fields.leaveReason !== undefined && attendance.status === "leave") {
    const leaveReason = assertString(fields.leaveReason, "leave reason", {
      maxLength: FEEDBACK_MAX_LENGTH,
    });
    if (!leaveReason.trim()) {
      throw new AppError("leave reason is required.", 400);
    }
    attendance.leaveReason = leaveReason;
  } else if (attendance.status === "leave" && fields.status !== undefined) {
    throw new AppError("leave reason is required.", 400);
  } else if (fields.leaveReason !== undefined) {
    if (fields.leaveReason !== null && String(fields.leaveReason).trim() !== "") {
      throw new AppError("leave reason is only allowed when status is leave.", 400);
    }
    attendance.leaveReason = undefined;
  }

  if (attendance.status !== "leave") {
    attendance.leaveReason = undefined;
  }

  await attendance.save();
  return attendance;
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

module.exports = { addAttendance, listAttendance, updateAttendance, getAttendanceSummary };
