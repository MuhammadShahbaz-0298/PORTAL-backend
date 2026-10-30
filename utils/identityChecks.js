// Checks for values that identify a person: email, password and grades.
// Grades are stored as text, so both "A" and "95" are accepted.

const { AppError } = require("./errors");
const { assertString } = require("./valueChecks");
const {
  EMAIL_MAX_LENGTH,
  GRADE_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} = require("../constants");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function assertEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || normalizedEmail.length > EMAIL_MAX_LENGTH) {
    throw new AppError("A valid email address is required.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AppError("A valid email address is required.", 400);
  }

  return normalizedEmail;
}

function assertPassword(password, field = "Password") {
  if (typeof password !== "string") {
    throw new AppError(`${field} must be text.`, 400);
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      `${field} must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
      400,
    );
  }

  return password;
}

// Marks may be numbers (0-100) or letter grades. Both are stored as text.
function assertGrade(value) {
  const grade = assertString(value, "grade", { maxLength: GRADE_MAX_LENGTH });
  const numericGrade = Number(grade);

  if (Number.isFinite(numericGrade) && (numericGrade < 0 || numericGrade > 100)) {
    throw new AppError("A numeric grade must be between 0 and 100.", 400);
  }

  return grade;
}

module.exports = { assertEmail, assertGrade, assertPassword, normalizeEmail };
