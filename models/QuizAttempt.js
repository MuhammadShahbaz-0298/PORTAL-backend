// One attempt per student per quiz.
// The score is auto-computed on submit.

const mongoose = require("mongoose");
const { QUIZ_ATTEMPT_STATUSES } = require("../constants");

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
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
    answers: {
      type: [Number],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(QUIZ_ATTEMPT_STATUSES),
      default: QUIZ_ATTEMPT_STATUSES.SUBMITTED,
      index: true,
    },
    score: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    focusViolationCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, strict: true },
);

quizAttemptSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
