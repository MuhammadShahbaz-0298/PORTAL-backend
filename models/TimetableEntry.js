// A timetable entry belongs to one batch and describes one scheduled slot.
// Entries are archived, never hard-deleted.

const mongoose = require("mongoose");
const { DAYS_OF_WEEK } = require("../constants");

const timetableEntrySchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

timetableEntrySchema.index({ batch: 1, dayOfWeek: 1, active: 1 });

module.exports = mongoose.model("TimetableEntry", timetableEntrySchema);
