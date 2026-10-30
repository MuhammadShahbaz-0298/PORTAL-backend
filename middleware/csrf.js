// CSRF protection for cookie-based login.
// The browser must send a custom header that a cross-site form cannot set.

const { AppError } = require("../utils/errors");
const { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } = require("../constants");

const UNSAFE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function csrfProtection(request, response, next) {
  if (!UNSAFE_METHODS.includes(request.method)) {
    return next();
  }

  if (request.get(CSRF_HEADER_NAME) === CSRF_HEADER_VALUE) {
    return next();
  }

  return next(new AppError("Missing CSRF protection header.", 403));
}

module.exports = csrfProtection;
