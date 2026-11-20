// HTTP controller for q ui zc on tr ol le r.
// Keeps request and response handling separate from business rules.
// HTTP layer for quizzes.

const quizService = require("../services/quizService");
const quizImportService = require("../services/quizImportService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");
const { AppError } = require("../utils/errors");

function getWorkbookBuffer(request) {
  if (!request.file) {
    throw new AppError("Upload an Excel workbook (.xlsx).", 400);
  }
  if (!request.file.originalname?.toLowerCase().endsWith(".xlsx")) {
    throw new AppError("Only .xlsx files are supported.", 400);
  }
  return request.file.buffer;
}

const downloadQuestionTemplate = asyncHandler(async (_request, response) => {
  const workbook = await quizImportService.createQuestionTemplate();
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", 'attachment; filename="quiz-questions-template.xlsx"');
  return response.send(workbook);
});

const importQuestions = asyncHandler(async (request, response) => {
  const questions = await quizImportService.importQuestions(getWorkbookBuffer(request));
  return response.json({ questions });
});

const listQuizzes = asyncHandler(async (request, response) => {
  const result = await quizService.listQuizzes({ requester: request.user, query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const getQuiz = asyncHandler(async (request, response) => {
  const quiz = await quizService.getQuiz({ requester: request.user, quizId: request.params.id });
  return response.json(quiz);
});

const createQuiz = asyncHandler(async (request, response) => {
  const quiz = await quizService.createQuiz({ requester: request.user, payload: request.body });
  return response.status(201).json(quiz);
});

const updateQuiz = asyncHandler(async (request, response) => {
  const quiz = await quizService.updateQuiz({
    requester: request.user,
    quizId: request.params.id,
    payload: request.body,
  });
  return response.json(quiz);
});

const submitAttempt = asyncHandler(async (request, response) => {
  const attempt = await quizService.submitAttempt({
    requester: request.user,
    quizId: request.params.id,
    payload: request.body,
  });
  return response.status(201).json(attempt);
});

const startAttempt = asyncHandler(async (request, response) => {
  const attempt = await quizService.startAttempt({
    requester: request.user,
    quizId: request.params.id,
  });
  return response.status(201).json(attempt);
});

const saveAttemptAnswers = asyncHandler(async (request, response) => {
  const attempt = await quizService.saveAttemptAnswers({
    requester: request.user,
    quizId: request.params.id,
    payload: request.body,
  });
  return response.json(attempt);
});

const recordFocusViolation = asyncHandler(async (request, response) => {
  const attempt = await quizService.recordFocusViolation({
    requester: request.user,
    quizId: request.params.id,
  });
  return response.json(attempt);
});

const listAttempts = asyncHandler(async (request, response) => {
  const result = await quizService.listAttempts({
    requester: request.user,
    quizId: request.params.id,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

module.exports = {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  submitAttempt,
  startAttempt,
  saveAttemptAnswers,
  recordFocusViolation,
  listAttempts,
  downloadQuestionTemplate,
  importQuestions,
};
