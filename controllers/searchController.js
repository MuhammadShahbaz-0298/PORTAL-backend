// HTTP layer for global search.

const searchService = require("../services/searchService");
const asyncHandler = require("../utils/asyncHandler");

const globalSearch = asyncHandler(async (request, response) => {
  const result = await searchService.globalSearch({
    requester: request.user,
    query: request.query,
  });
  return response.json(result);
});

module.exports = { globalSearch };
