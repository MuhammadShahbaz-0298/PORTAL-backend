// HTTP layer for the user list, user updates, password resets and soft delete.

const userService = require("../services/userService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listUsers = asyncHandler(async (request, response) => {
  const result = await userService.listUsers({ requester: request.user, query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const updateUser = asyncHandler(async (request, response) => {
  const user = await userService.updateUser({
    requester: request.user,
    userId: request.params.id,
    payload: request.body,
  });

  return response.json(user);
});

const resetPassword = asyncHandler(async (request, response) => {
  const temporaryPassword = await userService.resetPassword(request.user, request.params.id);
  return response.json({ temporaryPassword });
});

const deleteUser = asyncHandler(async (request, response) => {
  const result = await userService.deleteUser({
    requester: request.user,
    userId: request.params.id,
  });

  return response.json(result);
});

module.exports = { listUsers, updateUser, resetPassword, deleteUser };
