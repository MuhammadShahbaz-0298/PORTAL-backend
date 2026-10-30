// Cookie parsing and setting.
// The access and refresh tokens are httpOnly, so JavaScript can never read them.

const { AUTH_COOKIES } = require("../constants/auth");

function parseCookies(request) {
  const headerValue = request.headers.cookie;
  const cookies = {};

  if (!headerValue) {
    return cookies;
  }

  for (const part of headerValue.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
}

function getBearerToken(request) {
  const headerValue = request.headers.authorization;
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return "";
  }

  return headerValue.slice("Bearer ".length).trim();
}

function getAccessToken(request) {
  const cookies = parseCookies(request);
  return cookies[AUTH_COOKIES.ACCESS_NAME] || getBearerToken(request);
}

function getRefreshToken(request) {
  const cookies = parseCookies(request);
  return cookies[AUTH_COOKIES.REFRESH_NAME] || "";
}

function buildCookieOptions(cookieSettings, path, maxAgeMilliseconds) {
  return {
    httpOnly: cookieSettings.httpOnly,
    secure: cookieSettings.secure,
    sameSite: cookieSettings.sameSite,
    domain: cookieSettings.domain,
    path,
    maxAge: maxAgeMilliseconds,
  };
}

function setAuthCookies(response, tokens, authSettings, cookieSettings) {
  const accessMaxAge = authSettings.accessTokenMinutes * 60 * 1000;
  const refreshMaxAge = authSettings.refreshTokenDays * 24 * 60 * 60 * 1000;

  response.cookie(
    AUTH_COOKIES.ACCESS_NAME,
    tokens.accessToken,
    buildCookieOptions(cookieSettings, AUTH_COOKIES.ACCESS_PATH, accessMaxAge),
  );
  response.cookie(
    AUTH_COOKIES.REFRESH_NAME,
    tokens.refreshToken,
    buildCookieOptions(cookieSettings, AUTH_COOKIES.REFRESH_PATH, refreshMaxAge),
  );
}

function clearAuthCookies(response, cookieSettings) {
  response.clearCookie(
    AUTH_COOKIES.ACCESS_NAME,
    buildCookieOptions(cookieSettings, AUTH_COOKIES.ACCESS_PATH, 0),
  );
  response.clearCookie(
    AUTH_COOKIES.REFRESH_NAME,
    buildCookieOptions(cookieSettings, AUTH_COOKIES.REFRESH_PATH, 0),
  );
}

module.exports = {
  parseCookies,
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
