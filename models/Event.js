// Calendar event schema and indexes.
// Events may be school-wide or limited to one batch.

const mongoose = require("mongoose");
const { EVENT_TITLE_MAX_LENGTH, EVENT_DESCRIPTION_MAX_LENGTH } = require("../constants");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: EVENT_TITLE_MAX_LENGTH },
    description: {
      type: String,
      trim: true,
      maxlength: EVENT_DESCRIPTION_MAX_LENGTH,
      default: "",
    },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

eventSchema.index({ date: 1, active: 1 });
eventSchema.index({ batch: 1, active: 1 });

module.exports = mongoose.model("Event", eventSchema);
