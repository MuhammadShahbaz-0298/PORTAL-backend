// HTTP layer for quizzes.

const quizService = require("../services/quizService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

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
  listAttempts,
};
