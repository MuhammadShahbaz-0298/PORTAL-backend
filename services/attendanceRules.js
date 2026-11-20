// Validate dates and leave-reason rules for attendance writes.
// The teacher's timezone offset is applied before rejecting future dates.

const { FEEDBACK_MAX_LENGTH } = require("../constants");
const { AppError } = require("../utils/errors");
const { assertNumber, assertString } = require("../utils/validation");
const { startOfDay } = require("./attendanceReadService");

function readAttendanceDate(fields) {
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
  return date;
}

function applyLeaveReason(update, fields, status) {
  if (status === "leave") {
    const leaveReason = assertString(fields.leaveReason, "leave reason", {
      maxLength: FEEDBACK_MAX_LENGTH,
    });
    if (!leaveReason.trim()) {
      throw new AppError("leave reason is required.", 400);
    }
    update.$set.leaveReason = leaveReason;
    return;
  }

  if (
    fields.leaveReason !== undefined &&
    fields.leaveReason !== null &&
    String(fields.leaveReason).trim() !== ""
  ) {
    throw new AppError("leave reason is only allowed when status is leave.", 400);
  }
  update.$unset = { leaveReason: "" };
}

module.exports = { readAttendanceDate, applyLeaveReason };
