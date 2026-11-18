// Bulk CSV import for users and batch enrollment.
// Reuses the existing service functions; returns a per-row report.

const { parse } = require("csv-parse/sync");
const registrationService = require("./registrationService");
const batchService = require("./batchService");

async function bulkImportUsers({ requester, csvBuffer }) {
  const records = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });

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

async function bulkEnroll({ requester, batchId, csvBuffer }) {
  const records = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });

  const results = [];

  for (const row of records) {
    try {
      const enrollment = await batchService.enrollStudent({
        requester,
        batchId,
        payload: { studentId: row.studentId },
      });
      results.push({ row, success: true, enrollmentId: enrollment._id });
    } catch (error) {
      results.push({ row, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = { bulkImportUsers, bulkEnroll };
