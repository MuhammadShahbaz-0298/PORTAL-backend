// A risk flag marks a student who may need attention.
// Written by the at-risk detection job, not by users directly.

const mongoose = require("mongoose");
const { RISK_FLAG_STATUSES } = require("../constants");

const riskFlagSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    reasons: {
      type: [String],
      default: [],
    },
    attendancePercentage: { type: Number, min: 0, max: 100 },
    missedSubmissions: { type: Number, min: 0 },
    status: {
      type: String,
      enum: RISK_FLAG_STATUSES,
      default: "open",
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, strict: true },
);

riskFlagSchema.index({ student: 1, batch: 1, status: 1 });

module.exports = mongoose.model("RiskFlag", riskFlagSchema);
