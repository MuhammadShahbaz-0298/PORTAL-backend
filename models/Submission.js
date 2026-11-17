// One submission per student per assignment.
// Re-uploading replaces the file on the same record, so history cannot explode.

const mongoose = require("mongoose");
const {
  SUBMISSION_STATUSES,
  GRADE_MAX_LENGTH,
  FEEDBACK_MAX_LENGTH,
  GLOBAL_UPLOAD_MAX_BYTES,
  AI_DRAFT_STATUSES,
  AI_FEEDBACK_MAX_LENGTH,
  AI_ERROR_MAX_LENGTH,
} = require("../constants");

// One source file saved from the ZIP during the upload request.
const aiSnapshotFileSchema = new mongoose.Schema(
  {
    path: { type: String, maxlength: 300 },
    text: { type: String },
  },
  { _id: false },
);

// Everything the AI needs is copied here while the ZIP still exists on disk.
const aiSnapshotSchema = new mongoose.Schema(
  {
    files: { type: [aiSnapshotFileSchema], default: [] },
    truncated: { type: Boolean, default: false },
    totalChars: { type: Number, default: 0 },
  },
  { _id: false },
);

const aiDraftSchema = new mongoose.Schema(
  {
    status: { type: String, enum: AI_DRAFT_STATUSES, default: "pending" },
    feedback: { type: String, default: "", maxlength: AI_FEEDBACK_MAX_LENGTH },
    suggestedMarks: { type: Number, default: null, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    model: { type: String, default: "", maxlength: 100 },
    attempts: { type: Number, default: 0, min: 0 },
    generations: { type: Number, default: 0, min: 0 },
    error: { type: String, default: "", maxlength: AI_ERROR_MAX_LENGTH },
    generatedAt: { type: Date, default: null },
    requestedAt: { type: Date, default: null },
    // Stored source code can be large, so it is never returned by normal queries.
    snapshot: { type: aiSnapshotSchema, select: false },
  },
  { _id: false },
);

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
    // AI feedback is only a suggestion. The teacher still saves the real grade.
    aiDraft: { type: aiDraftSchema, default: undefined },
  },
  { timestamps: true, strict: true },
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ batch: 1, submittedAt: -1 });
// Used by the startup recovery scan for unfinished AI drafts.
submissionSchema.index({
  "aiDraft.status": 1,
  "aiDraft.attempts": 1,
  "aiDraft.requestedAt": 1,
});

module.exports = mongoose.model("Submission", submissionSchema);
