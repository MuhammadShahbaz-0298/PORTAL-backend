// Security events are logged with useful context, but never with passwords or tokens.
// Events are also persisted to the AuditLog collection so the audit-log endpoint can read them.

const AuditLog = require("../models/AuditLog");

function logSecurityEvent(event, details = {}) {
  const safeDetails = {
    event,
    at: new Date().toISOString(),
    ...details,
  };

  console.warn("[security]", JSON.stringify(safeDetails));

  // Best-effort persistence. Never let logging break the request.
  try {
    const persisted = { ...details };
    // Drop any keys that look like secrets.
    for (const key of Object.keys(persisted)) {
      if (/password|token|secret|cookie|hash/i.test(key)) {
        delete persisted[key];
      }
    }
    AuditLog.create({ event, details: persisted, at: new Date() }).catch(() => undefined);
  } catch {
    // Ignore persistence errors.
  }
}

module.exports = { logSecurityEvent };
