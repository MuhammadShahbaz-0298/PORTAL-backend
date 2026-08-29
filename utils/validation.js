const mongoose = require("mongoose");
const { AppError } = require("./errors");

const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => {
    const value = payload?.[field];
    return (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    );
  });
  if (missing.length)
    throw new AppError(`Missing required fields: ${missing.join(", ")}.`, 400);
};

const assertObjectId = (value, field = "id") => {
  if (!mongoose.isValidObjectId(value))
    throw new AppError(`Invalid ${field}.`, 400);
  return value;
};

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();
const assertEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new AppError("A valid email address is required.", 400);
  return normalized;
};

const assertPassword = (password, field = "Password") => {
  if (typeof password !== "string" || password.length < 8)
    throw new AppError(`${field} must be at least 8 characters.`, 400);
};

const assertEnum = (value, allowed, field) => {
  if (!allowed.includes(value))
    throw new AppError(`${field} must be one of: ${allowed.join(", ")}.`, 400);
  return value;
};

module.exports = {
  requireFields,
  assertObjectId,
  normalizeEmail,
  assertEmail,
  assertPassword,
  assertEnum,
};
