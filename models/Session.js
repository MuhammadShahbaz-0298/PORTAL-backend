// One login session. The refresh token is stored only as a SHA-256 hash.
// Rotating a token creates a new row and marks the old row as replaced.

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    // Every rotation keeps the same family id, so reuse can revoke the whole family.
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: "", maxlength: 500 },
    ip: { type: String, default: "", maxlength: 64 },
    revokedAt: { type: Date, default: null },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },
    // Absolute cap for the whole family, not just this one refresh token.
    familyCreatedAt: { type: Date, required: true },
    familyExpiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: true },
);

// MongoDB removes expired sessions automatically. No cron job needed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ familyId: 1, revokedAt: 1 });

module.exports = mongoose.model("Session", sessionSchema);
