// One search builder for every list endpoint.
// User text is escaped before it goes into a MongoDB regex.

const { assertSearch, escapeRegex } = require("./validation");

function buildSearchFilter(search, fields) {
  const cleanedSearch = assertSearch(search);

  if (!cleanedSearch) {
    return {};
  }

  const pattern = escapeRegex(cleanedSearch);
  const conditions = fields.map((field) => ({ [field]: { $regex: pattern, $options: "i" } }));

  return { $or: conditions };
}

module.exports = { buildSearchFilter };
