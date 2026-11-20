// HTTP controller for b ul ki mp or tc on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for bulk Excel import.

const bulkImportService = require("../services/bulkImportService");
const asyncHandler = require("../utils/asyncHandler");
const { AppError } = require("../utils/errors");

function getWorkbookBuffer(request) {
  if (!request.file) {
    throw new AppError("Upload an Excel workbook (.xlsx).", 400);
  }
  if (!request.file.originalname?.toLowerCase().endsWith(".xlsx")) {
    throw new AppError("Only .xlsx files are supported.", 400);
  }
  return request.file.buffer;
}

const bulkImportUsers = asyncHandler(async (request, response) => {
  const results = await bulkImportService.bulkImportUsers({
    requester: request.user,
    workbookBuffer: getWorkbookBuffer(request),
  });

  return response.json(results);
});

const bulkEnroll = asyncHandler(async (request, response) => {
  const results = await bulkImportService.bulkEnroll({
    requester: request.user,
    batchId: request.params.id,
    workbookBuffer: getWorkbookBuffer(request),
  });

  return response.json(results);
});

const downloadUserImportTemplate = asyncHandler(async (_request, response) => {
  const workbook = await bulkImportService.createUserImportTemplate();
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader(
    "Content-Disposition",
    'attachment; filename="user-import-template.xlsx"',
  );
  return response.send(workbook);
});

module.exports = { bulkImportUsers, bulkEnroll, downloadUserImportTemplate };
