// The only place that writes HTTP responses.
// Users see a short message; server logs get the real error.

const { AppError, isCastError, isDuplicateKeyError, isValidationError } = require("./errors");

const sendSuccess = (res, data, statusCode = 200, message = undefined) => {
  const payload = { success: true, data };
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
};

const sendError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;
  const message = isServerError ? "Internal server error." : error.message || "Request failed.";
  const payload = { success: false, error: message };

  if (!isServerError && error.details) {
    payload.details = error.details;
  }

  return res.status(statusCode).json(payload);
};

const normalizeError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  if (isDuplicateKeyError(error)) {
    return new AppError("A record with these details already exists.", 409);
  }

  if (isValidationError(error)) {
    const errorList = error.errors ? Object.values(error.errors) : [];
    const details = errorList.map((item) => item.message);
    return new AppError("Validation failed.", 400, details);
  }

  if (isCastError(error)) {
    return new AppError("One or more identifiers are invalid.", 400);
  }

  return error;
};

module.exports = { sendSuccess, sendError, normalizeError };
