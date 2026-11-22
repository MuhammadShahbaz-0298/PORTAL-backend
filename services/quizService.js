// Database work for quizzes and attempts.
// correctIndex is never returned to students.

const Quiz = require("../models/Quiz");
const Enrollment = require("../models/Enrollment");
const { ROLES, QUIZ_MAX_TIME_LIMIT_MINUTES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId, assertNumber, assertString, pickFields } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");
const quizAttemptService = require("./quizAttemptService");
const { cleanQuestions } = require("./quizValidation");
const notificationService = require("./notificationService");

// Strips correctIndex from a quiz for student responses.
function toStudentQuiz(quiz) {
  const value = quiz.toObject ? quiz.toObject() : { ...quiz };
  if (value.questions) {
    value.questions = value.questions.map((question) => ({
      text: question.text,
      options: question.options,
    }));
  }
  return value;
}

async function listQuizzes({ requester, query }) {
  const pagination = getPagination(query);
  const role = getUserRole(requester);
  const filters = [{ active: true }];
  const requestedBatchId = query.batchId ? assertObjectId(query.batchId, "batch id") : null;

  if (requestedBatchId) {
    filters.push({ batch: requestedBatchId });
  }

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  } else if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ batch: { $in: batchIds } });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await Quiz.countDocuments(filter);
  const items = await Quiz.find(filter)
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Hide correctIndex from students.
  if (role === ROLES.STUDENT) {
    return { items: items.map(toStudentQuiz), pagination, total };
  }

  return { items, pagination, total };
}

async function getQuiz({ requester, quizId }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId).populate("batch", "name");

  if (!quiz || !quiz.active) {
    throw new AppError("Quiz not found.", 404);
  }

  const role = getUserRole(requester);
  if (role === ROLES.STUDENT) {
    await batchAccessService.assertCanAccessBatch(requester, quiz.batch._id || quiz.batch);
    return toStudentQuiz(quiz);
  }

  if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, quiz.batch._id || quiz.batch);
  }

  return quiz;
}

async function createQuiz({ requester, payload }) {
  const fields = pickFields(payload, ["title", "batchId", "questions", "timeLimitMinutes"]);
  const title = assertString(fields.title, "title", { maxLength: 160 });
  const batchId = assertObjectId(fields.batchId, "batch id");
  const timeLimitMinutes = assertNumber(fields.timeLimitMinutes, "time limit", {
    min: 1,
    max: QUIZ_MAX_TIME_LIMIT_MINUTES,
    integer: true,
  });
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const quiz = await Quiz.create({
    title,
    batch: batchId,
    questions: cleanQuestions(fields.questions),
    timeLimitMinutes,
    createdBy: getUserId(requester),
  });

  // Quiz creation is already committed; notification failure must not undo it.
  try {
    const studentIds = await Enrollment.find({
      batch: batchId,
      active: { $ne: false },
    }).distinct("student");
    await notificationService.notifyNewQuiz({ quiz, studentIds });
  } catch (error) {
    console.error("[quiz_notification_failed]", {
      quizId: String(quiz._id),
      error: error.message,
    });
  }

  return quiz.populate("batch", "name");
}

async function updateQuiz({ requester, quizId, payload }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);

  if (!quiz) {
    throw new AppError("Quiz not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, quiz.batch);

  const fields = pickFields(payload, ["title", "questions", "timeLimitMinutes", "active"]);

  if (fields.title !== undefined) {
    quiz.title = assertString(fields.title, "title", { maxLength: 160 });
  }
  if (fields.questions !== undefined) {
    quiz.questions = cleanQuestions(fields.questions);
  }
  if (fields.timeLimitMinutes !== undefined) {
    quiz.timeLimitMinutes = assertNumber(fields.timeLimitMinutes, "time limit", {
      min: 1,
      max: QUIZ_MAX_TIME_LIMIT_MINUTES,
      integer: true,
    });
  }
  if (fields.active !== undefined) {
    quiz.active = fields.active === true;
    if (!quiz.active) {
      quiz.archivedAt = new Date();
    } else {
      quiz.archivedAt = null;
    }
  }

  await quiz.save();
  return quiz.populate("batch", "name");
}

module.exports = {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  toStudentQuiz,
  ...quizAttemptService,
};
