// Primitive input checks shared by every feature.
// These helpers throw AppError, so a bad request never reaches the database.

const mongoose = require("mongoose");
const { AppError } = require("./errors");
const objectChecks = require("./objectChecks");

function assertString(value, field, options = {}) {
  const { allowEmpty = false, maxLength = 1000, minLength = allowEmpty ? 0 : 1 } = options;

  if (typeof value !== "string") {
    throw new AppError(`${field} must be text.`, 400);
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length < minLength) {
    throw new AppError(`${field} is required.`, 400);
  }

  if (trimmedValue.length > maxLength) {
    throw new AppError(`${field} must be at most ${maxLength} characters.`, 400);
  }

  return trimmedValue;
}

function assertOptionalString(value, field, options = {}) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return assertString(value, field, options);
}

function assertBoolean(value, field) {
  if (value !== true && value !== false) {
    throw new AppError(`${field} must be true or false.`, 400);
  }

  return value;
}

function assertNumber(value, field, options = {}) {
  const { max, min, integer = false } = options;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(`${field} must be a number.`, 400);
  }

  if (integer && !Number.isInteger(value)) {
    throw new AppError(`${field} must be a whole number.`, 400);
  }

  if (min !== undefined && value < min) {
    throw new AppError(`${field} must be at least ${min}.`, 400);
  }

  if (max !== undefined && value > max) {
    throw new AppError(`${field} must be at most ${max}.`, 400);
  }

  return value;
}

function assertDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} must be a valid date.`, 400);
  }

  return date;
}

function assertEnum(value, allowedValues, field) {
  if (!allowedValues.includes(value)) {
    throw new AppError(`${field} must be one of: ${allowedValues.join(", ")}.`, 400);
  }

  return value;
}

function assertObjectId(value, field = "id") {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${field}.`, 400);
  }

  return value;
}

function assertArrayOfStrings(value, field, options = {}) {
  const { allowedValues, maxItems = 50, maxLength = 100 } = options;

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new AppError(`${field} must be a list of at most ${maxItems} items.`, 400);
  }

  const cleanedValues = [];

  for (const item of value) {
    if (typeof item !== "string") {
      throw new AppError(`${field} must contain text values only.`, 400);
    }

    const cleanedValue = item.trim();
    if (!cleanedValue || cleanedValue.length > maxLength) {
      throw new AppError(`${field} contains an invalid value.`, 400);
    }

    if (allowedValues && !allowedValues.includes(cleanedValue)) {
      throw new AppError(`${field} contains an unknown value.`, 400);
    }

    cleanedValues.push(cleanedValue);
  }

  return cleanedValues;
}

module.exports = {
  ...objectChecks,
  assertArrayOfStrings,
  assertBoolean,
  assertDate,
  assertEnum,
  assertNumber,
  assertObjectId,
  assertOptionalString,
  assertString,
};
