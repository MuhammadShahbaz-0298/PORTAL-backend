// HTTP controller for a ud it lo gc on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for audit log. Read-only.

const auditLogService = require("../services/auditLogService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listAuditLogs = asyncHandler(async (request, response) => {
  const result = await auditLogService.listAuditLogs({ query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

module.exports = { listAuditLogs };
