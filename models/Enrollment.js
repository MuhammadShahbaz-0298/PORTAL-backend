// Links one student to one batch.
// A student may be in more than one batch, but never twice in the same batch.

const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
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
    active: { type: Boolean, default: true },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

enrollmentSchema.index({ student: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
