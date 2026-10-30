// Every list endpoint reads page and limit in exactly the same way.

const { AppError } = require("./errors");
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("../constants");

function readPositiveInteger(value, field, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new AppError(`${field} must be a whole number greater than zero.`, 400);
  }

  return numberValue;
}

function getPagination(query = {}) {
  const page = readPositiveInteger(query.page, "page", 1);
  const limit = readPositiveInteger(query.limit, "limit", DEFAULT_PAGE_SIZE);

  if (limit > MAX_PAGE_SIZE) {
    throw new AppError(`limit must be at most ${MAX_PAGE_SIZE}.`, 400);
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

// The current API returns arrays, so we keep that shape and expose the total in a header.
function sendPaginatedList(res, items, pagination, total) {
  res.setHeader("X-Page", String(pagination.page));
  res.setHeader("X-Page-Limit", String(pagination.limit));
  res.setHeader("X-Total-Count", String(total));
  return res.json(items);
}

module.exports = { getPagination, sendPaginatedList };
