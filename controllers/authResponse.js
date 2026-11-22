// Shape authentication responses and set browser session cookies.
// Web clients remain cookie-only; mobile clients receive session tokens.

const { readAuthSettings, readCookieSettings } = require("../config/auth");
const { MOBILE_CLIENT_HEADER_NAME, SESSION_CLIENT_TYPES } = require("../constants/auth");
const { setAuthCookies } = require("../utils/cookies");

function saveLoginCookies(response, tokens) {
  setAuthCookies(response, tokens, readAuthSettings(), readCookieSettings());
}

function isMobileClient(request) {
  return request.get(MOBILE_CLIENT_HEADER_NAME) === SESSION_CLIENT_TYPES.MOBILE;
}

function buildSessionResponse(request, result) {
  const body = { user: result.user };
  if (isMobileClient(request)) {
    body.accessToken = result.accessToken;
    body.refreshToken = result.refreshToken;
  }
  return body;
}

module.exports = { saveLoginCookies, buildSessionResponse };
