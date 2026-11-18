// HTTP layer for CSV exports. Streams CSV.

const exportService = require("../services/exportService");
const asyncHandler = require("../utils/asyncHandler");

function sendCsv(response, csv, filename) {
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return response.send(csv);
}

const exportUsers = asyncHandler(async (request, response) => {
  const csv = await exportService.exportUsers({ requester: request.user });
  return sendCsv(response, csv, "users.csv");
});

const exportAttendance = asyncHandler(async (request, response) => {
  const csv = await exportService.exportAttendance({
    requester: request.user,
    query: request.query,
  });
  return sendCsv(response, csv, "attendance.csv");
});

const exportSubmissions = asyncHandler(async (request, response) => {
  const csv = await exportService.exportSubmissions({
    requester: request.user,
    query: request.query,
  });
  return sendCsv(response, csv, "submissions.csv");
});

module.exports = { exportUsers, exportAttendance, exportSubmissions };
