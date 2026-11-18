// One assignment belongs to one batch and is created by a teacher.
// Deleting an assignment archives it so old submissions keep their parent record.

const mongoose = require("mongoose");
const {
  ASSIGNMENT_TITLE_MAX_LENGTH,
  ASSIGNMENT_DESCRIPTION_MAX_LENGTH,
  ASSIGNMENT_RUBRIC_MAX_LENGTH,
  MAX_FILE_SIZE_MB_LIMIT,
  RESUBMISSION_POLICIES,
} = require("../constants");

const assignmentSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: ASSIGNMENT_TITLE_MAX_LENGTH,
    },
    description: {
      type: String,
      default: "",
      maxlength: ASSIGNMENT_DESCRIPTION_MAX_LENGTH,
    },
    // The teacher's marking guide. The AI uses it as extra context only.
    rubric: {
      type: String,
      default: "",
      maxlength: ASSIGNMENT_RUBRIC_MAX_LENGTH,
    },
    // Structured rubric: an array of criteria, each with a max score.
    // Additive: the old rubric string stays for backward compatibility.
    rubricItems: {
      type: [
        {
          criterion: { type: String, trim: true, maxlength: 200 },
          maxPoints: { type: Number, min: 0, default: 0 },
        },
      ],
      default: [],
    },
    dueDate: { type: Date, required: true },
    allowedFileTypes: { type: [String], default: ["zip"] },
    maxFileSizeMb: {
      type: Number,
      default: 25,
      min: 1,
      max: MAX_FILE_SIZE_MB_LIMIT,
    },
    resubmissionPolicy: {
      type: String,
      enum: RESUBMISSION_POLICIES,
      default: "allowed",
    },
    latePolicy: {
      type: {
        type: String,
        enum: ["none", "percentagePerDay", "flat"],
        default: "none",
      },
      percentage: { type: Number, min: 0, max: 100, default: 0 },
      flatAmount: { type: Number, min: 0, default: 0 },
      graceDays: { type: Number, min: 0, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: { type: Boolean, default: true },
    closedAt: { type: Date, default: null },
    // Teacher resource attachments.
    resources: {
      type: [
        {
          fileName: { type: String, maxlength: 255 },
          filePath: { type: String, maxlength: 255 },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, strict: true },
);

assignmentSchema.index({ batch: 1, active: 1 });
assignmentSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
