// HTTP layer for attendance.

const attendanceService = require("../services/attendanceService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const addAttendance = asyncHandler(async (request, response) => {
  const record = await attendanceService.addAttendance({
    requester: request.user,
    payload: request.body,
  });
  return response.status(200).json(record);
});

const listAttendance = asyncHandler(async (request, response) => {
  const result = await attendanceService.listAttendance({
    requester: request.user,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const updateAttendance = asyncHandler(async (request, response) => {
  const record = await attendanceService.updateAttendance({
    requester: request.user,
    attendanceId: request.params.id,
    payload: request.body,
  });
  return response.json(record);
});

const getAttendanceSummary = asyncHandler(async (request, response) => {
  const summary = await attendanceService.getAttendanceSummary({
    requester: request.user,
    studentId: request.params.studentId,
  });
  return response.json(summary);
});

module.exports = { addAttendance, listAttendance, updateAttendance, getAttendanceSummary };
