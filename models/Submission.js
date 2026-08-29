const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
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
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, default: "application/zip" },
    attempt: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["submitted", "graded", "rejected"],
      default: "submitted",
    },
    grade: { type: String, default: null },
    feedback: { type: String, default: null },
    submittedAt: { type: Date, default: Date.now },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

submissionSchema.index(
  { assignment: 1, student: 1, attempt: 1 },
  { unique: true },
);
module.exports = mongoose.model("Submission", submissionSchema);
