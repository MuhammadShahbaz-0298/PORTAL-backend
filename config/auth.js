// Reads the auth numbers from the environment and checks they are safe.
// The defaults are in constants/auth.js so there is only one place to look.

const { AUTH_LIMITS } = require("../constants/auth");

function readPositiveInteger(source, name, fallback) {
  const rawValue = source[name];

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number greater than zero.`);
  }

  return value;
}

function readAuthSettings(source = process.env) {
  const accessTokenMinutes = readPositiveInteger(
    source,
    "ACCESS_TOKEN_MINUTES",
    AUTH_LIMITS.ACCESS_TOKEN_MINUTES,
  );
  const idleTimeoutMinutes = readPositiveInteger(
    source,
    "IDLE_TIMEOUT_MINUTES",
    AUTH_LIMITS.IDLE_TIMEOUT_MINUTES,
  );
  const refreshTokenDays = readPositiveInteger(
    source,
    "REFRESH_TOKEN_DAYS",
    AUTH_LIMITS.REFRESH_TOKEN_DAYS,
  );
  const sessionMaxHours = readPositiveInteger(
    source,
    "SESSION_MAX_HOURS",
    AUTH_LIMITS.SESSION_MAX_HOURS,
  );

  // A token that lives longer than the idle timeout would keep a dead session alive.
  if (accessTokenMinutes > idleTimeoutMinutes) {
    throw new Error("ACCESS_TOKEN_MINUTES must not be longer than IDLE_TIMEOUT_MINUTES.");
  }

  if (sessionMaxHours * 60 < idleTimeoutMinutes) {
    throw new Error("SESSION_MAX_HOURS must be at least as long as IDLE_TIMEOUT_MINUTES.");
  }

  return {
    accessTokenMinutes,
    refreshTokenDays,
    idleTimeoutMinutes,
    sessionMaxHours,
    loginMaxAttempts: AUTH_LIMITS.LOGIN_MAX_ATTEMPTS,
    loginWindowMinutes: AUTH_LIMITS.LOGIN_WINDOW_MINUTES,
    lastActiveUpdateSeconds: AUTH_LIMITS.LAST_ACTIVE_UPDATE_SECONDS,
    refreshTokenBytes: AUTH_LIMITS.REFRESH_TOKEN_BYTES,
  };
}

// Cookies must be cross-site when the frontend and API are on different sites.
// SameSite=None only works together with Secure.
function readCookieSettings(source = process.env) {
  const isProduction = source.NODE_ENV === "production";

  return {
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    domain: source.COOKIE_DOMAIN || undefined,
    httpOnly: true,
  };
}

module.exports = { readAuthSettings, readCookieSettings };
