// A comment belongs to one submission and is written by one user.
// Comments are never hard-deleted.

const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

commentSchema.index({ submission: 1, active: 1, createdAt: 1 });
commentSchema.index({ author: 1, active: 1 });

module.exports = mongoose.model("Comment", commentSchema);
