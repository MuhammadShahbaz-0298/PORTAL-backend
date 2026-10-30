// One submission per student per assignment.
// Re-uploading replaces the file on the same record, so history cannot explode.

const mongoose = require("mongoose");
const {
  SUBMISSION_STATUSES,
  GRADE_MAX_LENGTH,
  FEEDBACK_MAX_LENGTH,
  GLOBAL_UPLOAD_MAX_BYTES,
} = require("../constants");

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
    // Only the random stored file name. Never the user's original path.
    filePath: { type: String, required: true, maxlength: 255 },
    // The original name is shown to the user, but never used as a disk path.
    fileName: { type: String, required: true, maxlength: 255 },
    fileSize: { type: Number, required: true, min: 1, max: GLOBAL_UPLOAD_MAX_BYTES },
    mimeType: { type: String, default: "application/zip", maxlength: 100 },
    attempt: { type: Number, required: true, min: 1, max: 1 },
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: "submitted",
    },
    grade: { type: String, default: null, maxlength: GRADE_MAX_LENGTH },
    feedback: { type: String, default: null, maxlength: FEEDBACK_MAX_LENGTH },
    submittedAt: { type: Date, default: Date.now },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ batch: 1, submittedAt: -1 });

module.exports = mongoose.model("Submission", submissionSchema);
