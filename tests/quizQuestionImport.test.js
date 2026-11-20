// Test quiz question workbooks, their template, and import permissions.
// Import previews questions without creating a quiz.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const ExcelJS = require("exceljs");
const Quiz = require("../models/Quiz");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const { createUser, login, workbookUpload } = require("./helpers/workflowFixtures");

let environment;
let adminClient;

async function questionWorkbook(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Questions");
  worksheet.addRow([
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "optionE",
    "optionF",
    "correctOption",
  ]);
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

before(async () => {
  environment = await startTestEnvironment();
});

after(async () => {
  await environment.stop();
});

beforeEach(async () => {
  await environment.cleanDatabase();
  resetLoginRateLimits();
  await ensureCoreRoles();
  await createUser("admin@example.test", "admin");
  adminClient = await login(environment, "admin@example.test");
});

test("quiz question template is an Excel workbook with an example", async () => {
  const response = await adminClient.download("/api/quizzes/questions/template");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /quiz-questions-template\.xlsx/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.body);
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Questions", "Example", "Instructions"],
  );
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), [
    "question",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "optionE",
    "optionF",
    "correctOption",
  ]);
  assert.equal(workbook.worksheets[1].rowCount, 3);
});

test("quiz question import maps correct option letters and creates no quiz", async () => {
  const buffer = await questionWorkbook([["What is 2 + 2?", "3", "4", "5", "", "", "", "B"]]);
  const response = await adminClient.upload(
    "/api/quizzes/questions/import",
    workbookUpload(buffer, "questions.xlsx"),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.data.questions, [
    {
      text: "What is 2 + 2?",
      options: ["3", "4", "5"],
      correctIndex: 1,
    },
  ]);
  assert.equal(await Quiz.countDocuments(), 0);
});

test("quiz question import rejects invalid answers and CSV files", async () => {
  const invalidBuffer = await questionWorkbook([["What is 2 + 2?", "3", "4", "", "", "", "", "C"]]);
  const invalid = await adminClient.upload(
    "/api/quizzes/questions/import",
    workbookUpload(invalidBuffer, "questions.xlsx"),
  );
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /must match a filled option/);

  const csv = new FormData();
  csv.append("file", new Blob(["question,optionA,optionB,correctOption"]), "questions.csv");
  const rejected = await adminClient.upload("/api/quizzes/questions/import", csv);
  assert.equal(rejected.status, 400);
});

test("students cannot download or import quiz question workbooks", async () => {
  await createUser("student@example.test", "student");
  const studentClient = await login(environment, "student@example.test");

  assert.equal((await studentClient.get("/api/quizzes/questions/template")).status, 403);
  const response = await studentClient.post("/api/quizzes/questions/import", new FormData());
  assert.equal(response.status, 403);
});
