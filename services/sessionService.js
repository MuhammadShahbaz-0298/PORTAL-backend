// Public session API.
// Code outside this module imports from here, so the storage split stays internal.

const sessionStore = require("./sessionStore");
const sessionLifecycle = require("./sessionLifecycle");
const { getAuthSettingsForClient } = require("../config/auth");
const { MOBILE_CLIENT_HEADER_NAME, SESSION_CLIENT_TYPES } = require("../constants/auth");

function getSessionClient(request, session) {
  const requestClient = String(request?.get?.(MOBILE_CLIENT_HEADER_NAME) || "").toLowerCase();
  return session?.client === SESSION_CLIENT_TYPES.MOBILE ||
    requestClient === SESSION_CLIENT_TYPES.MOBILE
    ? SESSION_CLIENT_TYPES.MOBILE
    : SESSION_CLIENT_TYPES.WEB;
}

module.exports = {
  ...sessionStore,
  ...sessionLifecycle,
  getSessionClient,
  getAuthSettingsForClient,
};
