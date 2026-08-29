const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
  },
  { timestamps: true },
);

// Prevent the same student being enrolled twice in the same batch
enrollmentSchema.index({ student: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
