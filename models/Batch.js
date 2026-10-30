// A batch is a class group taught by one teacher.
// Batches are archived, never hard-deleted, so attendance and submissions stay readable.

const mongoose = require("mongoose");
const { BATCH_NAME_MAX_LENGTH } = require("../constants");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: BATCH_NAME_MAX_LENGTH,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Soft delete: archived batches are hidden from lists but keep their history.
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

batchSchema.index({ teacher: 1, active: 1 });

module.exports = mongoose.model("Batch", batchSchema);
