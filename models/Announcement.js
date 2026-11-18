// An announcement is a message from a teacher or admin to a batch or to the whole school.
// Announcements are archived, never hard-deleted.

const mongoose = require("mongoose");
const { ANNOUNCEMENT_SCOPES } = require("../constants");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    scope: {
      type: String,
      enum: ANNOUNCEMENT_SCOPES,
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      index: true,
      default: null,
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

announcementSchema.index({ scope: 1, batch: 1, active: 1 });
announcementSchema.index({ createdBy: 1, active: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
