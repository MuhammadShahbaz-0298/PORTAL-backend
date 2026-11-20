// Create users, authenticated test clients, and spreadsheet upload fixtures.
// These helpers are limited to the workflow integration tests.

const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const User = require("../../models/User");

const PASSWORD = "Password123!";

async function createUser(email, role) {
  return User.create({
    name: email.split("@")[0],
    email,
    password: PASSWORD,
    role,
    active: true,
  });
}

async function login(environment, email) {
  const client = environment.createClient();
  const response = await client.post("/api/auth/login", {
    email,
    password: PASSWORD,
  });
  assert.equal(response.status, 200);
  return client;
}

async function userWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Users");
  sheet.addRow(["name", "email", "password", "role"]);
  sheet.addRow(["Imported Student", "imported@example.test", PASSWORD, "student"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function workbookUpload(buffer, filename = "users.xlsx") {
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
  return form;
}

module.exports = {
  PASSWORD,
  createUser,
  login,
  userWorkbookBuffer,
  workbookUpload,
};
