// The public validation entry point.
// Every route imports from this file, so the same checks run everywhere.
// Primitive checks live in valueChecks.js; person-specific checks live in identityChecks.js.

const { assertString } = require("./valueChecks");
const { SEARCH_MAX_LENGTH } = require("../constants");
const valueChecks = require("./valueChecks");
const identityChecks = require("./identityChecks");

// Copy only the fields the route is allowed to change. This stops mass assignment.
function pickFields(payload, allowedFields) {
  const pickedFields = {};

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      pickedFields[field] = payload[field];
    }
  }

  return pickedFields;
}

// User text is never put into a regex as-is.
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertSearch(search) {
  if (search === undefined || search === null || search === "") {
    return "";
  }

  return assertString(search, "search", { maxLength: SEARCH_MAX_LENGTH });
}

module.exports = {
  ...valueChecks,
  ...identityChecks,
  assertSearch,
  escapeRegex,
  pickFields,
};
