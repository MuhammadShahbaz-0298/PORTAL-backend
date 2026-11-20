// Database work for attendance.
// Teachers can only read or write attendance for batches they own.

const Attendance = require("../models/Attendance");
const Batch = require("../models/Batch");
const { ATTENDANCE_STATUSES, FEEDBACK_MAX_LENGTH, ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const {
  assertEnum,
  assertNumber,
  assertString,
  assertObjectId,
  pickFields,
} = require("../utils/validation");
const batchAccessService = require("./batchAccessService");
const attendanceReadService = require("./attendanceReadService");
const { readAttendanceDate, applyLeaveReason } = require("./attendanceRules");

const { startOfDay } = attendanceReadService;

async function assertBatchAvailable(requester, studentId, batchId) {
  await batchAccessService.assertCanManageBatch(requester, batchId);
  await batchAccessService.assertStudentEnrolled(studentId, batchId);
  const batch = await Batch.findOne({ _id: batchId, active: true }).select("name");

  if (!batch) {
    throw new AppError("Batch not found.", 404);
  }

  return batch;
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
  const date = readAttendanceDate(fields);
  const status = assertEnum(fields.status, ATTENDANCE_STATUSES, "status");

  const batch = await assertBatchAvailable(requester, studentId, batchId);
  const update = {
    $set: {
      status,
      enteredBy: getUserId(requester),
      batchName: batch.name,
    },
    $setOnInsert: { student: studentId, batch: batchId, date },
  };

  applyLeaveReason(update, fields, status);

  return Attendance.findOneAndUpdate({ student: studentId, batch: batchId, date }, update, {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
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

module.exports = { addAttendance, updateAttendance, ...attendanceReadService };
