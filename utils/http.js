const {
  AppError,
  isCastError,
  isDuplicateKeyError,
  isValidationError,
} = require("./errors");

const sendSuccess = (res, data, statusCode = 200, message = undefined) => {
  const payload = { success: true, data };
  if (message) payload.message = message;
  return res.status(statusCode).json(payload);
};

const sendError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    success: false,
    error: error.message || "Internal server error",
  };
  if (error.details) payload.details = error.details;
  return res.status(statusCode).json(payload);
};

const normalizeError = (error) => {
  if (error instanceof AppError) return error;
  if (isDuplicateKeyError(error))
    return new AppError("A record with these details already exists.", 409);
  if (isValidationError(error)) {
    const details = Object.values(error.errors).map((item) => item.message);
    return new AppError("Validation failed.", 400, details);
  }
  if (isCastError(error))
    return new AppError("One or more identifiers are invalid.", 400);
  return error;
};

module.exports = { sendSuccess, sendError, normalizeError };
