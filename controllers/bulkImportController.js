// HTTP layer for bulk CSV import.

const bulkImportService = require("../services/bulkImportService");
const asyncHandler = require("../utils/asyncHandler");
const fs = require("fs");

const bulkImportUsers = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw new (require("../utils/errors").AppError)("No CSV file uploaded.", 400);
  }

  const buffer = fs.readFileSync(request.file.path);
  const results = await bulkImportService.bulkImportUsers({
    requester: request.user,
    csvBuffer: buffer,
  });

  // Clean up uploaded file.
  fs.unlinkSync(request.file.path);

  return response.json(results);
});

const bulkEnroll = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw new (require("../utils/errors").AppError)("No CSV file uploaded.", 400);
  }

  const buffer = fs.readFileSync(request.file.path);
  const results = await bulkImportService.bulkEnroll({
    requester: request.user,
    batchId: request.params.id,
    csvBuffer: buffer,
  });

  fs.unlinkSync(request.file.path);

  return response.json(results);
});

module.exports = { bulkImportUsers, bulkEnroll };
