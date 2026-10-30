// Creates and reads session rows.
// A session row is one refresh token. Only the SHA-256 hash is stored.

const crypto = require("crypto");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const { hashRefreshToken } = require("./tokenService");

const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;

function getRequestDetails(request) {
  return {
    ip: String(request.ip || "").slice(0, 64),
    userAgent: String(request.get("user-agent") || "").slice(0, 500),
  };
}

function calculateExpiryDate(settings, familyExpiresAt, now = Date.now()) {
  const slidingExpiry = now + settings.refreshTokenDays * DAY_MILLISECONDS;
  return new Date(Math.min(slidingExpiry, familyExpiresAt.getTime()));
}

async function createSession({
  userId,
  refreshToken,
  familyId,
  familyCreatedAt,
  familyExpiresAt,
  request,
  settings,
  now = Date.now(),
}) {
  const sessionId = new mongoose.Types.ObjectId();
  const tokenHash = hashRefreshToken(refreshToken);
  const requestDetails = getRequestDetails(request);

  await Session.create({
    _id: sessionId,
    user: userId,
    tokenHash,
    familyId,
    expiresAt: calculateExpiryDate(settings, familyExpiresAt, now),
    lastActiveAt: new Date(now),
    userAgent: requestDetails.userAgent,
    ip: requestDetails.ip,
    familyCreatedAt,
    familyExpiresAt,
  });

  return { sessionId, refreshToken };
}

function buildSessionFamily(settings, now = Date.now()) {
  return {
    familyId: crypto.randomUUID(),
    familyCreatedAt: new Date(now),
    familyExpiresAt: new Date(now + settings.sessionMaxHours * HOUR_MILLISECONDS),
  };
}

async function findSessionByRefreshToken(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  return Session.findOne({ tokenHash });
}

async function findSessionById(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) {
    return null;
  }

  return Session.findById(sessionId);
}

async function touchSession(session, settings, now = Date.now()) {
  const updateMilliseconds = settings.lastActiveUpdateSeconds * 1000;

  if (now - session.lastActiveAt.getTime() < updateMilliseconds) {
    return;
  }

  await Session.updateOne(
    { _id: session._id, revokedAt: null, replacedBy: null },
    { $set: { lastActiveAt: new Date(now) } },
  );
}

module.exports = {
  buildSessionFamily,
  createSession,
  findSessionByRefreshToken,
  findSessionById,
  touchSession,
};
