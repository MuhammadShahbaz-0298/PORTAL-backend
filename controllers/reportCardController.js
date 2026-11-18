// HTTP layer for report card PDF export.

const reportCardService = require("../services/reportCardService");
const asyncHandler = require("../utils/asyncHandler");

const getReportCard = asyncHandler(async (request, response) => {
  const pdfBuffer = await reportCardService.buildReportCard({
    requester: request.user,
    userId: request.params.id,
    batchId: request.query.batchId,
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="report-card-${request.params.id}.pdf"`,
  );
  return response.send(pdfBuffer);
});

module.exports = { getReportCard };
