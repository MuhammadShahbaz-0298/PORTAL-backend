// Test that imports, templates, and exports use Excel workbooks.
// CSV is intentionally rejected by the user-import endpoint.

const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const ExcelJS = require("exceljs");
const { startTestEnvironment } = require("./helpers/integration");
const { ensureCoreRoles } = require("../services/roleService");
const { resetLoginRateLimits } = require("../utils/rateLimit");
const {
  createUser,
  login,
  userWorkbookBuffer,
  workbookUpload,
} = require("./helpers/workflowFixtures");

let environment;
let adminClient;

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

test("user template and exports are valid Excel workbooks", async () => {
  const template = await adminClient.download("/api/users/bulk-import/template");
  assert.equal(template.status, 200);
  assert.match(
    template.headers.get("content-type"),
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );

  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.load(template.body);
  assert.deepEqual(
    templateWorkbook.worksheets.map((sheet) => sheet.name),
    ["Users", "Example"],
  );
  assert.deepEqual(templateWorkbook.worksheets[0].getRow(1).values.slice(1), [
    "name",
    "email",
    "password",
    "role",
  ]);

  const exported = await adminClient.download("/api/users/export");
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition"), /filename="users\.xlsx"/);
  const exportWorkbook = new ExcelJS.Workbook();
  await exportWorkbook.xlsx.load(exported.body);
  assert.equal(exportWorkbook.worksheets[0].name, "Users");

  const attendanceExport = await adminClient.download("/api/attendance/export");
  const attendanceWorkbook = new ExcelJS.Workbook();
  await attendanceWorkbook.xlsx.load(attendanceExport.body);
  assert.equal(attendanceWorkbook.worksheets[0].name, "Attendance");

  const submissionsExport = await adminClient.download("/api/submissions/export");
  const submissionsWorkbook = new ExcelJS.Workbook();
  await submissionsWorkbook.xlsx.load(submissionsExport.body);
  assert.equal(submissionsWorkbook.worksheets[0].name, "Submissions");
});

test("user import accepts xlsx and rejects CSV uploads", async () => {
  const imported = await adminClient.upload(
    "/api/users/bulk-import",
    workbookUpload(await userWorkbookBuffer()),
  );
  assert.equal(imported.status, 200);
  assert.equal(imported.data[0].success, true);
  assert.equal(imported.data[0].row.email, "imported@example.test");

  const csv = new FormData();
  csv.append(
    "file",
    new Blob(["name,email,password,role\nWrong,wrong@example.test,Password123!,student"]),
    "users.csv",
  );
  const rejected = await adminClient.upload("/api/users/bulk-import", csv);
  assert.equal(rejected.status, 400);
});
