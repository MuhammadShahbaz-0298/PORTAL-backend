class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const isDuplicateKeyError = (error) => error?.code === 11000;
const isValidationError = (error) => error?.name === 'ValidationError';
const isCastError = (error) => error?.name === 'CastError';

module.exports = {
  AppError,
  isDuplicateKeyError,
  isValidationError,
  isCastError,
};

