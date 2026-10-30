// Every token and session number lives in this one file.
// Change a default here, or set the matching environment variable on Railway.

const AUTH_LIMITS = Object.freeze({
  // How long one access token works. Short on purpose.
  ACCESS_TOKEN_MINUTES: 10,

  // How long a family of refresh tokens may live.
  REFRESH_TOKEN_DAYS: 7,

  // A user who does nothing for this long is logged out by the server.
  IDLE_TIMEOUT_MINUTES: 10,

  // Hard cap. Even an active user must log in again after this many hours.
  SESSION_MAX_HOURS: 24,

  // Login lockout: after this many failures in the window, block the key.
  LOGIN_MAX_ATTEMPTS: 10,
  LOGIN_WINDOW_MINUTES: 15,

  // Save at most one lastActiveAt write per minute.
  LAST_ACTIVE_UPDATE_SECONDS: 60,

  // crypto.randomBytes(64) gives a 128-character hex refresh token.
  REFRESH_TOKEN_BYTES: 64,
});

const AUTH_COOKIES = Object.freeze({
  ACCESS_NAME: "portal_access",
  REFRESH_NAME: "portal_refresh",
  ACCESS_PATH: "/",
  // The refresh cookie is never sent to normal API routes.
  REFRESH_PATH: "/api/auth",
});

// A user with a temporary password may call only this route.
const CHANGE_PASSWORD_ENDPOINT = "/api/auth/change-password";

module.exports = { AUTH_LIMITS, AUTH_COOKIES, CHANGE_PASSWORD_ENDPOINT };
