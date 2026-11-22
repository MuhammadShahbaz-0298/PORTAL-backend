// Creates and reads session rows.
// A session row is one refresh token. Only the SHA-256 hash is stored.

const crypto = require("crypto");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const {
  MOBILE_CLIENT_HEADER_NAME,
  USER_AGENT_HEADER_NAME,
  SESSION_CLIENT_TYPES,
} = require("../constants/auth");
const { hashRefreshToken } = require("./tokenService");

const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS;

function getRequestDetails(request) {
  const client = String(request.get(MOBILE_CLIENT_HEADER_NAME) || "").toLowerCase();
  return {
    ip: String(request.ip || "").slice(0, 64),
    userAgent: String(request.get(USER_AGENT_HEADER_NAME) || "").slice(0, 500),
    client:
      client === SESSION_CLIENT_TYPES.MOBILE
        ? SESSION_CLIENT_TYPES.MOBILE
        : SESSION_CLIENT_TYPES.WEB,
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
    client: requestDetails.client,
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

async function listSessionsForUser(userId) {
  return Session.find({ user: userId, revokedAt: null, replacedBy: null })
    .select("-tokenHash")
    .sort({ lastActiveAt: -1 })
    .lean();
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
  listSessionsForUser,
  touchSession,
};
