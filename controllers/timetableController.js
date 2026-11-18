// HTTP layer for timetable entries.

const timetableService = require("../services/timetableService");
const asyncHandler = require("../utils/asyncHandler");
const { sendPaginatedList } = require("../utils/pagination");

const listEntries = asyncHandler(async (request, response) => {
  const result = await timetableService.listEntries({
    requester: request.user,
    query: request.query,
  });
  return sendPaginatedList(response, result.items, result.pagination, result.total);
});

const createEntry = asyncHandler(async (request, response) => {
  const entry = await timetableService.createEntry({
    requester: request.user,
    payload: request.body,
  });
  return response.status(201).json(entry);
});

const updateEntry = asyncHandler(async (request, response) => {
  const entry = await timetableService.updateEntry({
    requester: request.user,
    entryId: request.params.id,
    payload: request.body,
  });
  return response.json(entry);
});

const archiveEntry = asyncHandler(async (request, response) => {
  const result = await timetableService.archiveEntry({
    requester: request.user,
    entryId: request.params.id,
  });
  return response.json(result);
});

module.exports = { listEntries, createEntry, updateEntry, archiveEntry };
