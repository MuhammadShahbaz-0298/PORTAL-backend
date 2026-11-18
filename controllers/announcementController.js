// HTTP layer for announcements.

const announcementService = require("../services/announcementService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listAnnouncements = asyncHandler(async (request, response) => {
  const result = await announcementService.listAnnouncements({
    requester: request.user,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createAnnouncement = asyncHandler(async (request, response) => {
  const announcement = await announcementService.createAnnouncement({
    requester: request.user,
    payload: request.body,
  });
  return response.status(201).json(announcement);
});

const updateAnnouncement = asyncHandler(async (request, response) => {
  const announcement = await announcementService.updateAnnouncement({
    requester: request.user,
    announcementId: request.params.id,
    payload: request.body,
  });
  return response.json(announcement);
});

const archiveAnnouncement = asyncHandler(async (request, response) => {
  const result = await announcementService.archiveAnnouncement({
    requester: request.user,
    announcementId: request.params.id,
  });
  return response.json(result);
});

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
};
