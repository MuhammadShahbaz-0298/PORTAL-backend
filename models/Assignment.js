// One assignment belongs to one batch and is created by a teacher.
// Deleting an assignment archives it so old submissions keep their parent record.

const mongoose = require("mongoose");
const {
  ASSIGNMENT_TITLE_MAX_LENGTH,
  ASSIGNMENT_DESCRIPTION_MAX_LENGTH,
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: { type: Boolean, default: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

assignmentSchema.index({ batch: 1, active: 1 });
assignmentSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
