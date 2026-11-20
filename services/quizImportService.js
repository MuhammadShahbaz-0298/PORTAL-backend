// Excel import and template generation for quiz questions.
// Only question prompts, options, and the correct option letter are accepted.

const ExcelJS = require("exceljs");
const { AppError } = require("../utils/errors");
const { parseWorkbookRows } = require("../utils/excelWorkbook");
const { cleanQuestions } = require("./quizValidation");

const OPTION_HEADERS = ["optiona", "optionb", "optionc", "optiond", "optione", "optionf"];
const REQUIRED_HEADERS = ["question", "optiona", "optionb", "correctoption"];

async function importQuestions(workbookBuffer) {
  const rows = await parseWorkbookRows(workbookBuffer, REQUIRED_HEADERS);
  if (!rows.length) {
    throw new AppError("The workbook must contain at least one question.", 400);
  }

  return rows.map((row, index) => {
    const options = OPTION_HEADERS.map((header) => row[header] || "");
    while (options.length && !options[options.length - 1]) options.pop();

    if (options.some((option) => !option)) {
      throw new AppError(`Question ${index + 1}: fill options in order from A through F.`, 400);
    }

    const correctOption = String(row.correctoption || "").toUpperCase();
    if (!/^[A-F]$/.test(correctOption)) {
      throw new AppError(`Question ${index + 1}: correctOption must be a letter from A to F.`, 400);
    }

    const correctIndex = correctOption.charCodeAt(0) - 65;
    if (correctIndex >= options.length) {
      throw new AppError(`Question ${index + 1}: correctOption must match a filled option.`, 400);
    }

    try {
      return cleanQuestions([{ text: row.question, options, correctIndex }])[0];
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      throw new AppError(`Question ${index + 1}: ${error.message}`, 400);
    }
  });
}

async function createQuestionTemplate() {
  const workbook = new ExcelJS.Workbook();
  const headers = [
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "optionE",
    "optionF",
    "correctOption",
  ];
  const widths = [48, 24, 24, 24, 24, 24, 24, 18];
  const questions = workbook.addWorksheet("Questions");
  questions.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: widths[index],
  }));
  questions.views = [{ state: "frozen", ySplit: 1 }];
  questions.getRow(1).font = { bold: true };

  const example = workbook.addWorksheet("Example");
  example.addRow(headers);
  example.addRow([
    "Which planet is known as the Red Planet?",
    "Earth",
    "Mars",
    "Venus",
    "Jupiter",
    "",
    "",
    "B",
  ]);
  example.addRow(["How many sides does a triangle have?", "Two", "Three", "Four", "", "", "", "B"]);
  example.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: widths[index],
  }));
  example.views = [{ state: "frozen", ySplit: 1 }];
  example.getRow(1).font = { bold: true };

  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRows([
    ["Guideline", "Details"],
    ["One question per row", "Enter each question on the Questions worksheet."],
    ["Options", "Fill at least optionA and optionB; add up to optionF."],
    ["Correct answer", "Enter the letter A-F matching the correct filled option."],
    ["Import behavior", "Questions are added to the quiz draft for review and editing."],
    ["Examples", "See the Example worksheet for two completed question rows."],
  ]);
  instructions.columns = [{ width: 22 }, { width: 86 }];
  instructions.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { importQuestions, createQuestionTemplate };
