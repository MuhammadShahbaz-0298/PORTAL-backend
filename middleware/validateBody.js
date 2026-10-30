// Reject non-object bodies and NoSQL operators before any controller sees them.
// Every write route gets the same check.

const { assertNoMongoOperators, assertPlainObject } = require("../utils/validation");

const WRITE_METHODS = ["POST", "PUT", "PATCH"];

function validateBodyShape(request, response, next) {
  if (!WRITE_METHODS.includes(request.method)) {
    return next();
  }

  const body = request.body === undefined ? {} : request.body;

  try {
    assertPlainObject(body, "body");
    assertNoMongoOperators(body, "body");
  } catch (error) {
    return next(error);
  }

  return next();
}

module.exports = validateBodyShape;
