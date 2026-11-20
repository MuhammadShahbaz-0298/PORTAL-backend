// Validate plain objects and reject NoSQL operator keys.
// Recursive checks stop nested input from reaching MongoDB as executable operators.

const { AppError } = require("./errors");

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, field = "body") {
  if (!isPlainObject(value)) {
    throw new AppError(`${field} must be an object.`, 400);
  }
  return value;
}

function assertNoMongoOperators(value, path = "body") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMongoOperators(item, `${path}[${index}]`));
    return value;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$")) {
      throw new AppError(`${path} contains a forbidden key.`, 400);
    }
    assertNoMongoOperators(child, `${path}.${key}`);
  }
  return value;
}

module.exports = { isPlainObject, assertPlainObject, assertNoMongoOperators };
