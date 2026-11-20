// Clean question input before it is saved to a quiz.
// Each question requires bounded text, between two and six options, and a valid answer index.

const { AppError } = require("../utils/errors");
const { assertString, assertNumber } = require("../utils/validation");

function cleanQuestions(value) {
  const questions = Array.isArray(value) ? value : [];
  return questions.map((question) => {
    const text = assertString(question.text, "question text", { maxLength: 5000 });
    const options = Array.isArray(question.options)
      ? question.options.map((option) => assertString(option, "option", { maxLength: 500 }))
      : [];
    if (options.length < 2 || options.length > 6) {
      throw new AppError("Each question needs 2 to 6 options.", 400);
    }

    const correctIndex = assertNumber(question.correctIndex, "correctIndex", {
      min: 0,
      max: options.length - 1,
      integer: true,
    });
    return { text, options, correctIndex };
  });
}

module.exports = { cleanQuestions };
