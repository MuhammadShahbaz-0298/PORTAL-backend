// A quiz belongs to one batch and is created by a teacher.
// Questions store the correct index, but it is never sent to students.

const mongoose = require("mongoose");
const { ASSIGNMENT_TITLE_MAX_LENGTH, QUIZ_MAX_TIME_LIMIT_MINUTES } = require("../constants");

const quizQuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    options: {
      type: [String],
      required: true,
      validate: (value) => Array.isArray(value) && value.length >= 2 && value.length <= 6,
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const quizSchema = new mongoose.Schema(
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
    questions: {
      type: [quizQuestionSchema],
      default: [],
    },
    timeLimitMinutes: {
      type: Number,
      min: 1,
      max: QUIZ_MAX_TIME_LIMIT_MINUTES,
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

quizSchema.index({ batch: 1, active: 1 });
quizSchema.index({ createdBy: 1, active: 1 });

module.exports = mongoose.model("Quiz", quizSchema);
