// Creates and checks tokens.
// The access token is a JWT. The refresh token is a random string, never a JWT.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { readAuthSettings } = require("../config/auth");

const TOKEN_ISSUER = "portal-backend";

function signAccessToken(user, sessionId, settings = readAuthSettings()) {
  return jwt.sign(
    {
      userId: String(user._id),
      sessionId: String(sessionId),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: `${settings.accessTokenMinutes}m`,
      issuer: TOKEN_ISSUER,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { issuer: TOKEN_ISSUER });
}

function createRefreshToken(settings = readAuthSettings()) {
  return crypto.randomBytes(settings.refreshTokenBytes).toString("hex");
}

// Only the hash is stored, so a database leak does not expose usable tokens.
function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  hashRefreshToken,
};
