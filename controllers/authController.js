// HTTP layer for login, refresh, logout, registration and password changes.

const User = require("../models/User");
const Batch = require("../models/Batch");
const authService = require("../services/authService");
const registrationService = require("../services/registrationService");
const passwordService = require("../services/passwordService");
const batchService = require("../services/batchService");
const batchAccessService = require("../services/batchAccessService");
const sessionService = require("../services/sessionService");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const asyncHandler = require("../utils/asyncHandler");
const { readAuthSettings, readCookieSettings } = require("../config/auth");
const { clearAuthCookies, getRefreshToken, setAuthCookies } = require("../utils/cookies");
const { assertObjectId, assertPassword } = require("../utils/validation");

function saveLoginCookies(response, tokens) {
  setAuthCookies(response, tokens, readAuthSettings(), readCookieSettings());
}

const register = asyncHandler(async (request, response) => {
  let batchId;

  // Check the batch before creating the user, so a denied enrollment leaves no orphan account.
  if (request.body.batchId !== undefined) {
    batchId = assertObjectId(request.body.batchId, "batchId");
    const batch = await Batch.findOne({ _id: batchId, active: true });

    if (!batch) {
      throw new AppError("Batch not found.", 404);
    }

    if (request.user.role !== ROLES.ADMIN) {
      await batchAccessService.assertCanManageBatch(request.user, batchId);
    }

    if (request.body.role !== undefined && request.body.role !== ROLES.STUDENT) {
      throw new AppError("Only student accounts can be enrolled in a batch.", 400);
    }
  }

  const user = await registrationService.registerUser({
    actor: request.user,
    payload: request.body,
  });

  if (batchId) {
    await batchService.enrollStudent({
      requester: request.user,
      batchId,
      payload: { studentId: user.id },
    });
  }

  return response.status(201).json({ user });
});

const login = asyncHandler(async (request, response) => {
  const result = await authService.loginUser({
    email: request.body.email,
    password: request.body.password,
    request,
  });

  saveLoginCookies(response, result);
  return response.json({ user: result.user });
});

const refresh = asyncHandler(async (request, response) => {
  const refreshToken = getRefreshToken(request);

  try {
    const result = await authService.refreshSession({ refreshToken, request });
    saveLoginCookies(response, result);
    return response.json({ user: result.user });
  } catch (error) {
    clearAuthCookies(response, readCookieSettings());
    throw error;
  }
});

const logout = asyncHandler(async (request, response) => {
  const refreshToken = getRefreshToken(request);

  if (refreshToken) {
    const session = await sessionService.findSessionByRefreshToken(refreshToken);

    if (session) {
      await sessionService.revokeSession(session._id);
    }
  }

  clearAuthCookies(response, readCookieSettings());
  return response.json({ message: "Logged out." });
});

const logoutAll = asyncHandler(async (request, response) => {
  await authService.logoutAllSessions(request.user.userId);
  clearAuthCookies(response, readCookieSettings());
  return response.json({ message: "Logged out from all devices." });
});

const getMe = asyncHandler(async (request, response) => {
  const user = await User.findById(request.user.userId).select("-password");

  if (!user || !user.active) {
    throw new AppError("Account is not active.", 401);
  }

  const safeUser = user.toObject();
  safeUser.permissions = request.user.permissions;
  return response.json(safeUser);
});

const changePassword = asyncHandler(async (request, response) => {
  if (typeof request.body.currentPassword !== "string") {
    throw new AppError("Current password is required.", 400);
  }

  const newPassword = assertPassword(request.body.newPassword, "New password");

  await passwordService.changePassword({
    userId: request.user.userId,
    currentPassword: request.body.currentPassword,
    newPassword,
    currentSessionId: request.session.id,
  });

  return response.json({ message: "Password updated." });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  changePassword,
};
