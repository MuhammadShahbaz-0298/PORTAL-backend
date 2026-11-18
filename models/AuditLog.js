// An audit log entry is a persisted security event.
// Read-only via the API; written by securityLog.js.

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false, strict: true },
);

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ event: 1, at: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
