// HTTP controller for e xp or tc on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for Excel exports.

const exportService = require("../services/exportService");
const asyncHandler = require("../utils/asyncHandler");

function sendExcel(response, workbook, filename) {
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return response.send(workbook);
}

const exportUsers = asyncHandler(async (request, response) => {
  const workbook = await exportService.exportUsers({ requester: request.user });
  return sendExcel(response, workbook, "users.xlsx");
});

const exportAttendance = asyncHandler(async (request, response) => {
  const workbook = await exportService.exportAttendance({
    requester: request.user,
    query: request.query,
  });
  return sendExcel(response, workbook, "attendance.xlsx");
});

const exportSubmissions = asyncHandler(async (request, response) => {
  const workbook = await exportService.exportSubmissions({
    requester: request.user,
    query: request.query,
  });
  return sendExcel(response, workbook, "submissions.xlsx");
});

module.exports = { exportUsers, exportAttendance, exportSubmissions };
