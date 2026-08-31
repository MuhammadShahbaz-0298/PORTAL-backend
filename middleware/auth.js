const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/errors");

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new AppError("Authentication token is required.", 401));

  const token = header.slice("Bearer ".length).trim();
  if (!token)
    return next(new AppError("Authentication token is required.", 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const maxSessionMs = 10 * 60 * 1000;
    const tokenAgeMs = Date.now() - decoded.iat * 1000;

    if (tokenAgeMs > maxSessionMs) {
      return next(new AppError("Your session has expired due to inactivity.", 401));
    }

    req.user = decoded;
    return next();
  } catch {
    return next(new AppError("Invalid or expired token.", 401));
  }
};

module.exports = auth;
