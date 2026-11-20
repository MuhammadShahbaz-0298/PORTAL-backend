// Shared utility for a sy nc ha nd le r.
// Provides reusable behavior across application features.
// Wrap async route handlers so thrown errors reach the central error handler.

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

module.exports = asyncHandler;
