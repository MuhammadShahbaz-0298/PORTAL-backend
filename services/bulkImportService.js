// Import users and batch enrollment rows from Excel workbooks.
// Each valid workbook row gets an independent result in the import report.

const registrationService = require("./registrationService");
const batchEnrollmentService = require("./batchEnrollmentService");
const { parseWorkbookRows, createUserImportTemplate } = require("../utils/excelWorkbook");

async function bulkImportUsers({ requester, workbookBuffer }) {
  const records = await parseWorkbookRows(workbookBuffer, ["name", "email", "password", "role"]);
  const results = [];

  for (const row of records) {
    try {
      const user = await registrationService.registerUser({
        actor: requester,
        payload: {
          name: row.name,
          email: row.email,
          password: row.password,
          role: row.role || "student",
        },
      });
      results.push({ row, success: true, userId: user.id });
    } catch (error) {
      results.push({ row, success: false, error: error.message });
    }
  }

  return results;
}

async function bulkEnroll({ requester, batchId, workbookBuffer }) {
  const records = await parseWorkbookRows(workbookBuffer, ["studentid"]);
  const results = [];

  for (const row of records) {
    try {
      const enrollment = await batchEnrollmentService.enrollStudent({
        requester,
        batchId,
        payload: { studentId: row.studentid },
      });
      results.push({ row, success: true, enrollmentId: enrollment._id });
    } catch (error) {
      results.push({ row, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  bulkImportUsers,
  bulkEnroll,
  createUserImportTemplate,
  parseWorkbookRows,
};
