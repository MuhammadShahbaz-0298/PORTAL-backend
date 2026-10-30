// Runs on every protected route.
// It checks the access token, then loads the CURRENT user and session from MongoDB.

const User = require("../models/User");
const { AppError } = require("../utils/errors");
const asyncHandler = require("../utils/asyncHandler");
const { getAccessToken, clearAuthCookies } = require("../utils/cookies");
const { readAuthSettings, readCookieSettings } = require("../config/auth");
const { logSecurityEvent } = require("../utils/securityLog");
const { CHANGE_PASSWORD_ENDPOINT } = require("../constants/auth");
const tokenService = require("../services/tokenService");
const sessionService = require("../services/sessionService");
const { getEffectivePermissions } = require("../services/permissionService");

// The temporary-password block must not lock the user out of changing it.
function isChangePasswordRequest(request) {
  const requestPath = request.originalUrl.split("?")[0].replace(/\/+$/, "");
  return request.method === "POST" && requestPath === CHANGE_PASSWORD_ENDPOINT;
}

const auth = asyncHandler(async (request, response, next) => {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    throw new AppError("Authentication required.", 401);
  }

  let tokenPayload;
  try {
    tokenPayload = tokenService.verifyAccessToken(accessToken);
  } catch {
    throw new AppError("Session expired or invalid.", 401);
  }

  const authSettings = readAuthSettings();
  const session = await sessionService.findSessionById(tokenPayload.sessionId);
  const sessionProblem = sessionService.getSessionProblem(session, authSettings);

  if (sessionProblem) {
    if (session) {
      await sessionService.revokeSession(session._id);
    }

    if (sessionProblem === "idle") {
      logSecurityEvent("session_idle_timeout", { userId: String(session.user) });
    }

    clearAuthCookies(response, readCookieSettings());
    throw new AppError("Session expired due to inactivity.", 401);
  }

  const user = await User.findById(session.user);

  // A deleted, disabled or archived user is rejected even if the token is still valid.
  if (!user || !user.active) {
    await sessionService.revokeAllForUser(session.user);
    clearAuthCookies(response, readCookieSettings());
    logSecurityEvent("disabled_user_rejected", { userId: String(session.user) });
    throw new AppError("Account is not active.", 401);
  }

  // A reset account may only change its password until the flag is cleared.
  if (user.mustChangePassword && !isChangePasswordRequest(request)) {
    throw new AppError("You must change your password before continuing.", 403);
  }

  await sessionService.touchSession(session, authSettings);

  request.user = {
    userId: String(user._id),
    id: String(user._id),
    role: user.role,
    active: user.active,
    permissions: await getEffectivePermissions(user),
  };
  request.session = {
    id: String(session._id),
    familyId: session.familyId,
  };

  return next();
});

module.exports = auth;
