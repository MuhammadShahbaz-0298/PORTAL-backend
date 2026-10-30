// One attendance record per student, batch and calendar day.
// The unique index stops the same day being saved twice.

const mongoose = require("mongoose");
const { ATTENDANCE_STATUSES, BATCH_NAME_MAX_LENGTH } = require("../constants");

const attendanceSchema = new mongoose.Schema(
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
    // Kept so old records still show a batch name if the batch is archived.
    batchName: { type: String, trim: true, maxlength: BATCH_NAME_MAX_LENGTH },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: true,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, strict: true },
);

attendanceSchema.index({ student: 1, batch: 1, date: 1 }, { unique: true });
attendanceSchema.index({ batch: 1, date: 1 });
attendanceSchema.index({ student: 1, date: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
