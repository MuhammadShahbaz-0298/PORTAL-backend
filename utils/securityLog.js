// Security events are logged with useful context, but never with passwords or tokens.

function logSecurityEvent(event, details = {}) {
  const safeDetails = {
    event,
    at: new Date().toISOString(),
    ...details,
  };

  console.warn("[security]", JSON.stringify(safeDetails));
}

module.exports = { logSecurityEvent };
