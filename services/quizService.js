// Database work for quizzes and attempts.
// correctIndex is never returned to students.

const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const { ROLES } = require("../constants");
const { AppError } = require("../utils/errors");
const { getUserId, getUserRole } = require("../utils/authorization");
const { assertObjectId, assertString, assertNumber, pickFields } = require("../utils/validation");
const { getPagination } = require("../utils/pagination");
const batchAccessService = require("./batchAccessService");

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

  if (role === ROLES.TEACHER) {
    const ownedBatchIds = await batchAccessService.getTeacherBatchIds(getUserId(requester));
    filters.push({ batch: { $in: ownedBatchIds } });
  } else if (role === ROLES.STUDENT) {
    const batchIds = await batchAccessService.getStudentBatchIds(getUserId(requester));
    filters.push({ batch: { $in: batchIds } });
  } else if (role === "guardian") {
    const guardianService = require("./guardianService");
    const children = await guardianService.getLinkedChildren({ requester });
    // Guardians see quizzes for their children's batches.
    const childIds = children.map((c) => c._id);
    const enrollments = await require("../models/Enrollment")
      .find({ student: { $in: childIds } })
      .select("batch")
      .lean();
    const batchIds = enrollments.map((e) => e.batch);
    filters.push({ batch: { $in: batchIds } });
  }

  const filter = filters.length ? { $and: filters } : {};
  const total = await Quiz.countDocuments(filter);
  const items = await Quiz.find(filter)
    .populate("batch", "name")
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Hide correctIndex from students and guardians.
  if (role === ROLES.STUDENT || role === "guardian") {
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
  if (role === ROLES.STUDENT || role === "guardian") {
    return toStudentQuiz(quiz);
  }

  if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, quiz.batch._id || quiz.batch);
  }

  return quiz;
}

async function createQuiz({ requester, payload }) {
  const fields = pickFields(payload, ["title", "batchId", "questions"]);
  const title = assertString(fields.title, "title", { maxLength: 160 });
  const batchId = assertObjectId(fields.batchId, "batch id");
  await batchAccessService.assertCanManageBatch(requester, batchId);

  const questions = Array.isArray(fields.questions) ? fields.questions : [];
  const cleanedQuestions = questions.map((q) => {
    const text = assertString(q.text, "question text", { maxLength: 5000 });
    const options = Array.isArray(q.options)
      ? q.options.map((o) => assertString(o, "option", { maxLength: 500 }))
      : [];
    if (options.length < 2 || options.length > 6) {
      throw new AppError("Each question needs 2 to 6 options.", 400);
    }
    const correctIndex = assertNumber(q.correctIndex, "correctIndex", {
      min: 0,
      max: options.length - 1,
      integer: true,
    });
    return { text, options, correctIndex };
  });

  const quiz = await Quiz.create({
    title,
    batch: batchId,
    questions: cleanedQuestions,
    createdBy: getUserId(requester),
  });

  return quiz.populate("batch", "name");
}

async function updateQuiz({ requester, quizId, payload }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);

  if (!quiz) {
    throw new AppError("Quiz not found.", 404);
  }

  await batchAccessService.assertCanManageBatch(requester, quiz.batch);

  const fields = pickFields(payload, ["title", "questions", "active"]);

  if (fields.title !== undefined) {
    quiz.title = assertString(fields.title, "title", { maxLength: 160 });
  }
  if (fields.questions !== undefined) {
    const questions = Array.isArray(fields.questions) ? fields.questions : [];
    quiz.questions = questions.map((q) => {
      const text = assertString(q.text, "question text", { maxLength: 5000 });
      const options = Array.isArray(q.options)
        ? q.options.map((o) => assertString(o, "option", { maxLength: 500 }))
        : [];
      if (options.length < 2 || options.length > 6) {
        throw new AppError("Each question needs 2 to 6 options.", 400);
      }
      const correctIndex = assertNumber(q.correctIndex, "correctIndex", {
        min: 0,
        max: options.length - 1,
        integer: true,
      });
      return { text, options, correctIndex };
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

async function submitAttempt({ requester, quizId, payload }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);

  if (!quiz || !quiz.active) {
    throw new AppError("Quiz not found.", 404);
  }

  const role = getUserRole(requester);
  if (role !== ROLES.STUDENT) {
    throw new AppError("Only students can submit quiz attempts.", 403);
  }

  const studentId = getUserId(requester);
  await batchAccessService.assertStudentEnrolled(studentId, quiz.batch);

  const existing = await QuizAttempt.findOne({ quiz: quizId, student: studentId });
  if (existing) {
    throw new AppError("You already submitted this quiz.", 409);
  }

  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const total = quiz.questions.length;
  let score = 0;

  for (let i = 0; i < quiz.questions.length; i++) {
    const question = quiz.questions[i];
    const answer = answers[i];
    if (typeof answer === "number" && answer === question.correctIndex) {
      score += 1;
    }
  }

  const attempt = await QuizAttempt.create({
    quiz: quizId,
    student: studentId,
    batch: quiz.batch,
    answers,
    score,
    total,
  });

  return attempt;
}

async function listAttempts({ requester, quizId, query }) {
  assertObjectId(quizId, "quiz id");
  const quiz = await Quiz.findById(quizId);

  if (!quiz) {
    throw new AppError("Quiz not found.", 404);
  }

  const role = getUserRole(requester);
  const filters = [{ quiz: quizId }];

  if (role === ROLES.STUDENT) {
    filters.push({ student: getUserId(requester) });
  } else if (role === ROLES.TEACHER) {
    await batchAccessService.assertCanManageBatch(requester, quiz.batch);
  }

  const pagination = getPagination(query);
  const total = await QuizAttempt.countDocuments({ $and: filters });
  const items = await QuizAttempt.find({ $and: filters })
    .populate("student", "name email")
    .sort({ submittedAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return { items, pagination, total };
}

module.exports = {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  submitAttempt,
  listAttempts,
  toStudentQuiz,
};
