// Shared validation and scoring for quiz attempts.
// Unanswered questions use -1 so partial and timed submissions stay explicit.

const { QUIZ_ATTEMPT_STATUSES } = require("../constants");
const { AppError } = require("../utils/errors");

function normalizeAnswers(value, questions) {
  if (!Array.isArray(value) || value.length > questions.length) {
    throw new AppError("Answers must match the quiz questions.", 400);
  }

  return questions.map((question, index) => {
    const answer = value[index];
    if (answer === undefined || answer === null || answer === -1) return -1;
    if (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
      throw new AppError("An answer is invalid for this question.", 400);
    }
    return answer;
  });
}

async function finalizeAttempt(attempt, quiz, answers) {
  const normalized = normalizeAnswers(answers, quiz.questions);
  attempt.answers = normalized;
  attempt.score = quiz.questions.reduce(
    (score, question, index) => score + (normalized[index] === question.correctIndex ? 1 : 0),
    0,
  );
  attempt.total = quiz.questions.length;
  attempt.status = QUIZ_ATTEMPT_STATUSES.SUBMITTED;
  attempt.submittedAt = new Date();
  await attempt.save();
  return attempt;
}

module.exports = { normalizeAnswers, finalizeAttempt };
