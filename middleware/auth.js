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
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(new AppError("Invalid or expired token.", 401));
  }
};

module.exports = auth;
