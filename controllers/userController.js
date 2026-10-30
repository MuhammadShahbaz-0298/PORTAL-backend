// HTTP layer for the user list, user updates and soft delete.

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

const deleteUser = asyncHandler(async (request, response) => {
  const result = await userService.deleteUser({
    requester: request.user,
    userId: request.params.id,
  });

  return response.json(result);
});

module.exports = { listUsers, updateUser, deleteUser };
