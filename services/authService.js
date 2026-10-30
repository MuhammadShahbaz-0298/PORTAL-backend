// Login, refresh and logout.
// All token rotation and reuse detection lives here.

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { readAuthSettings } = require("../config/auth");
const { AppError } = require("../utils/errors");
const { normalizeEmail } = require("../utils/validation");
const tokenService = require("./tokenService");
const sessionService = require("./sessionService");
const { toSafeUser } = require("./registrationService");
const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require("../utils/rateLimit");
const { logSecurityEvent } = require("../utils/securityLog");

// A dummy hash makes "unknown email" take as long as "wrong password".
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 10);

function buildLoginError() {
  return new AppError("Invalid email or password.", 401);
}

async function createLoginSession({ user, request, settings }) {
  const family = sessionService.buildSessionFamily(settings);
  const refreshToken = tokenService.createRefreshToken(settings);
  const session = await sessionService.createSession({
    userId: user._id,
    refreshToken,
    familyId: family.familyId,
    familyCreatedAt: family.familyCreatedAt,
    familyExpiresAt: family.familyExpiresAt,
    request,
    settings,
  });
  const accessToken = tokenService.signAccessToken(user, session.sessionId, settings);

  return { accessToken, refreshToken };
}

async function loginUser({ email, password, request }) {
  const settings = readAuthSettings();
  const normalizedEmail = normalizeEmail(email);
  const ip = String(request.ip || "");

  if (!normalizedEmail || typeof password !== "string") {
    throw new AppError("Email and password are required.", 400);
  }

  const rateCheck = checkLoginAllowed(ip, normalizedEmail, settings);
  if (!rateCheck.allowed) {
    logSecurityEvent("login_rate_limited", { ip, email: normalizedEmail });
    throw new AppError("Too many login attempts. Please try again later.", 429);
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    recordLoginFailure(ip, normalizedEmail, settings);
    logSecurityEvent("login_failed", { ip, email: normalizedEmail });
    throw buildLoginError();
  }

  const passwordMatches = await user.comparePassword(password);

  if (!passwordMatches || !user.active) {
    recordLoginFailure(ip, normalizedEmail, settings);
    logSecurityEvent("login_failed", { ip, email: normalizedEmail, disabled: !user.active });
    throw buildLoginError();
  }

  clearLoginFailures(ip, normalizedEmail);
  const tokens = await createLoginSession({ user, request, settings });

  return {
    user: await toSafeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

async function refreshSession({ refreshToken, request }) {
  const settings = readAuthSettings();
  sessionService.requireRefreshToken(refreshToken);
  const session = await sessionService.findSessionByRefreshToken(refreshToken);

  if (!session) {
    throw new AppError("Session is invalid or expired.", 401);
  }

  // A token that was already replaced means someone is replaying an old token.
  if (session.replacedBy) {
    await sessionService.revokeFamily(session.familyId);
    logSecurityEvent("refresh_token_reuse", {
      userId: String(session.user),
      familyId: session.familyId,
    });
    throw new AppError("Session is invalid or expired.", 401);
  }

  const sessionProblem = sessionService.getSessionProblem(session, settings);
  if (sessionProblem) {
    await sessionService.revokeSession(session._id);
    throw new AppError("Session is invalid or expired.", 401);
  }

  const user = await User.findById(session.user);

  if (!user || !user.active) {
    await sessionService.revokeAllForUser(session.user);
    logSecurityEvent("refresh_disabled_user", { userId: String(session.user) });
    throw new AppError("Session is invalid or expired.", 401);
  }

  const newRefreshToken = tokenService.createRefreshToken(settings);
  const rotatedSession = await sessionService.rotateSession({
    session,
    newRefreshToken,
    request,
    settings,
  });

  if (!rotatedSession) {
    await sessionService.revokeFamily(session.familyId);
    logSecurityEvent("refresh_token_reuse", {
      userId: String(session.user),
      familyId: session.familyId,
    });
    throw new AppError("Session is invalid or expired.", 401);
  }

  const accessToken = tokenService.signAccessToken(user, rotatedSession.sessionId, settings);

  return {
    user: await toSafeUser(user),
    accessToken,
    refreshToken: rotatedSession.refreshToken,
  };
}

async function logoutSession(sessionId) {
  await sessionService.revokeSession(sessionId);
}

async function logoutAllSessions(userId) {
  await sessionService.revokeAllForUser(userId);
}

module.exports = {
  loginUser,
  refreshSession,
  logoutSession,
  logoutAllSessions,
};
