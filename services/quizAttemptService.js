// Database work for quiz attempts.
// In-progress attempts keep their answers and server-controlled expiry.

const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const { ROLES, QUIZ_ATTEMPT_STATUSES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const { finalizeAttempt, normalizeAnswers } = require("./quizAttemptLogic");

const MAX_FOCUS_WARNINGS = 2;

async function getStudentQuiz(requester, quizId) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);
  if (!quiz || !quiz.active) throw new AppError("Quiz not found.", 404);
  if (getUserRole(requester) !== ROLES.STUDENT) {
    throw new AppError("Only students can take quizzes.", 403);
  }

  const studentId = getUserId(requester);
  await batchAccessService.assertCanAccessBatch(requester, quiz.batch);
  return { quiz, studentId };
}

async function startAttempt({ requester, quizId }) {
  const { quiz, studentId } = await getStudentQuiz(requester, quizId);
  let attempt = await QuizAttempt.findOne({ quiz: quizId, student: studentId });

  if (attempt) {
    if (
      attempt.status === QUIZ_ATTEMPT_STATUSES.IN_PROGRESS &&
      attempt.expiresAt &&
      Date.now() >= attempt.expiresAt.getTime()
    ) {
      return finalizeAttempt(attempt, quiz, attempt.answers);
    }
    return attempt;
  }

  const startedAt = new Date();
  const expiresAt = quiz.timeLimitMinutes
    ? new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60 * 1000)
    : null;
  try {
    attempt = await QuizAttempt.create({
      quiz: quizId,
      student: studentId,
      batch: quiz.batch,
      answers: Array(quiz.questions.length).fill(-1),
      status: QUIZ_ATTEMPT_STATUSES.IN_PROGRESS,
      startedAt,
      expiresAt,
      total: quiz.questions.length,
      submittedAt: null,
    });
    return attempt;
  } catch (error) {
    if (error.code !== 11000) throw error;
    return QuizAttempt.findOne({ quiz: quizId, student: studentId });
  }
}

async function saveAttemptAnswers({ requester, quizId, payload }) {
  const { quiz, studentId } = await getStudentQuiz(requester, quizId);
  const attempt = await QuizAttempt.findOne({ quiz: quizId, student: studentId });
  if (!attempt) throw new AppError("Start the quiz before saving answers.", 409);
  if (attempt.status !== QUIZ_ATTEMPT_STATUSES.IN_PROGRESS) {
    throw new AppError("This quiz attempt has already been submitted.", 409);
  }
  if (attempt.expiresAt && Date.now() >= attempt.expiresAt.getTime()) {
    return finalizeAttempt(attempt, quiz, attempt.answers);
  }

  attempt.answers = normalizeAnswers(payload?.answers, quiz.questions);
  await attempt.save();
  return attempt;
}

async function submitAttempt({ requester, quizId, payload }) {
  const { quiz, studentId } = await getStudentQuiz(requester, quizId);
  const attempt = await QuizAttempt.findOne({ quiz: quizId, student: studentId });
  if (!attempt) throw new AppError("Start the quiz before submitting.", 409);
  if (attempt.status !== QUIZ_ATTEMPT_STATUSES.IN_PROGRESS) {
    throw new AppError("You already submitted this quiz.", 409);
  }
  if (attempt.expiresAt && Date.now() >= attempt.expiresAt.getTime()) {
    return finalizeAttempt(attempt, quiz, attempt.answers);
  }

  return finalizeAttempt(attempt, quiz, normalizeAnswers(payload?.answers, quiz.questions));
}

async function recordFocusViolation({ requester, quizId }) {
  const { quiz, studentId } = await getStudentQuiz(requester, quizId);
  const attempt = await QuizAttempt.findOne({ quiz: quizId, student: studentId });
  if (!attempt) throw new AppError("Start the quiz before recording a violation.", 409);
  if (attempt.status !== QUIZ_ATTEMPT_STATUSES.IN_PROGRESS) {
    throw new AppError("This quiz attempt has already been submitted.", 409);
  }
  if (attempt.expiresAt && Date.now() >= attempt.expiresAt.getTime()) {
    return finalizeAttempt(attempt, quiz, attempt.answers);
  }

  attempt.focusViolationCount = (attempt.focusViolationCount || 0) + 1;
  if (attempt.focusViolationCount > MAX_FOCUS_WARNINGS) {
    return finalizeAttempt(attempt, quiz, attempt.answers);
  }

  await attempt.save();
  return attempt;
}

async function listAttempts({ requester, quizId, query }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);

  if (!quiz) throw new AppError("Quiz not found.", 404);

  const role = getUserRole(requester);
  const filters = [{ quiz: quizId }, { status: { $ne: QUIZ_ATTEMPT_STATUSES.IN_PROGRESS } }];

  if (role === ROLES.STUDENT) {
    filters.push({ student: getUserId(requester) });
  } else if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, quiz.batch);
  }

  const pagination = getPagination(query);
  const filter = { $and: filters };
  const total = await QuizAttempt.countDocuments(filter);
  const items = await QuizAttempt.find(filter)
    .populate("student", "name email")
    .sort({ submittedAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

module.exports = {
  startAttempt,
  saveAttemptAnswers,
  submitAttempt,
  recordFocusViolation,
  listAttempts,
};
