// HTTP controller for e ve nt co nt ro ll er.
// Keeps request and response handling separate from business rules.
const eventService = require("../services/eventService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listEvents = asyncHandler(async (request, response) => {
  const result = await eventService.listEvents({ requester: request.user, query: request.query });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createEvent = asyncHandler(async (request, response) => {
  const event = await eventService.createEvent({ requester: request.user, payload: request.body });
  return response.status(201).json(event);
});

const updateEvent = asyncHandler(async (request, response) => {
  const event = await eventService.updateEvent({
    requester: request.user,
    eventId: request.params.id,
    payload: request.body,
  });
  return response.json(event);
});

const archiveEvent = asyncHandler(async (request, response) => {
  const result = await eventService.archiveEvent({
    requester: request.user,
    eventId: request.params.id,
  });
  return response.json(result);
});

module.exports = { listEvents, createEvent, updateEvent, archiveEvent };
