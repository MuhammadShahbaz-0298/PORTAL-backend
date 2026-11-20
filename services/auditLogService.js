// Business logic for a ud it lo gs er vi ce.
// Encapsulates feature rules and database access.
// Database work for audit log entries. Read-only.

const AuditLog = require("../models/AuditLog");
const { getPagination } = require("../utils/pagination");
const { assertOptionalString } = require("../utils/validation");

async function listAuditLogs({ query }) {
  const pagination = getPagination(query);
  const filter = {};

  const event = assertOptionalString(query.event, "event", { maxLength: 100 });
  if (event) {
    filter.event = event;
  }

  const total = await AuditLog.countDocuments(filter);
  const items = await AuditLog.find(filter)
    .sort({ at: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  return { items, pagination, total };
}

module.exports = { listAuditLogs };
