// HTTP controller for notification inbox routes.
// User identity comes from auth middleware; request bodies cannot choose an owner.

const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listNotifications = asyncHandler(async (request, response) => {
  const result = await notificationService.listNotifications({
    recipientId: request.user.userId,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const markAsRead = asyncHandler(async (request, response) => {
  const notification = await notificationService.markAsRead({
    recipientId: request.user.userId,
    notificationId: request.params.id,
  });
  return response.json(notification);
});

const clearAll = asyncHandler(async (request, response) => {
  const result = await notificationService.clearAllForRecipient({
    recipientId: request.user.userId,
  });
  return response.json(result);
});

module.exports = {
  listNotifications,
  markAsRead,
  clearAll,
};
