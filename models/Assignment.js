const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 5000 },
    dueDate: { type: Date, required: true },
    allowedFileTypes: { type: [String], default: ["zip"] },
    maxFileSizeMb: { type: Number, default: 25, min: 1, max: 250 },
    resubmissionPolicy: {
      type: String,
      enum: ["disabled", "allowed"],
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
  { timestamps: true },
);

module.exports = mongoose.model("Assignment", assignmentSchema);
