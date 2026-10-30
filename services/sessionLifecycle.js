// Session lifecycle: validity checks, rotation and revocation.
// Rotation is atomic, so two parallel refreshes cannot both succeed.

const mongoose = require("mongoose");
const Session = require("../models/Session");
const { AppError } = require("../utils/errors");
const { createSession } = require("./sessionStore");

function getSessionProblem(session, settings, now = Date.now()) {
  if (!session) {
    return "missing";
  }

  if (session.replacedBy) {
    return "reused";
  }

  if (session.revokedAt) {
    return "revoked";
  }

  if (session.expiresAt.getTime() <= now) {
    return "expired";
  }

  if (session.familyExpiresAt.getTime() <= now) {
    return "family-expired";
  }

  const idleMilliseconds = settings.idleTimeoutMinutes * 60 * 1000;
  if (now - session.lastActiveAt.getTime() > idleMilliseconds) {
    return "idle";
  }

  return "";
}

// Returns null when another request already rotated this token. That is a reuse signal.
async function rotateSession({ session, newRefreshToken, request, settings, now = Date.now() }) {
  const newSessionId = new mongoose.Types.ObjectId();
  const replacedSession = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null, replacedBy: null },
    { $set: { revokedAt: new Date(now), replacedBy: newSessionId } },
    { new: false },
  );

  if (!replacedSession) {
    return null;
  }

  await createSession({
    userId: session.user,
    refreshToken: newRefreshToken,
    familyId: session.familyId,
    familyCreatedAt: session.familyCreatedAt,
    familyExpiresAt: session.familyExpiresAt,
    request,
    settings,
    now,
  });

  return { sessionId: newSessionId, refreshToken: newRefreshToken };
}

async function revokeSession(sessionId, now = Date.now()) {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(now) } },
  );
}

async function revokeFamily(familyId, now = Date.now()) {
  await Session.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date(now) } });
}

async function revokeAllForUser(userId, now = Date.now()) {
  await Session.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(now) } },
  );
}

async function revokeOtherSessions(userId, currentSessionId, now = Date.now()) {
  await Session.updateMany(
    { user: userId, _id: { $ne: currentSessionId }, revokedAt: null },
    { $set: { revokedAt: new Date(now) } },
  );
}

function requireRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError("Refresh token is missing.", 401);
  }
}

module.exports = {
  getSessionProblem,
  rotateSession,
  revokeSession,
  revokeFamily,
  revokeAllForUser,
  revokeOtherSessions,
  requireRefreshToken,
};
