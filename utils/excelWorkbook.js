// Read and generate Excel workbooks shared by spreadsheet workflows.
// Imports consume only the first worksheet and normalize headers to lowercase.

const ExcelJS = require("exceljs");
const { AppError } = require("./errors");

function cellText(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((item) => item.text || "")
        .join("")
        .trim();
    }
    if (value.text !== undefined) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
  }
  return String(value).trim();
}

async function parseWorkbookRows(workbookBuffer, requiredHeaders) {
  if (!Buffer.isBuffer(workbookBuffer)) {
    throw new AppError("Upload an Excel workbook (.xlsx).", 400);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(workbookBuffer);
  } catch {
    throw new AppError("The uploaded file is not a valid .xlsx workbook.", 400);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError("The workbook must contain a first worksheet.", 400);
  }

  const headers = worksheet
    .getRow(1)
    .values.slice(1)
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    );
  const nonEmptyHeaders = headers.filter(Boolean);
  if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) {
    throw new AppError("The first worksheet contains duplicate column names.", 400);
  }

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new AppError(
      `The first worksheet must include these columns: ${requiredHeaders.join(", ")}.`,
      400,
    );
  }

  const records = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cellText(row.getCell(index + 1));
    });
    if (Object.values(record).some(Boolean)) records.push(record);
  }

  return records;
}

async function createUserImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const usersSheet = workbook.addWorksheet("Users");
  usersSheet.columns = [
    { header: "name", key: "name", width: 28 },
    { header: "email", key: "email", width: 32 },
    { header: "password", key: "password", width: 32 },
    { header: "role", key: "role", width: 16 },
  ];
  usersSheet.views = [{ state: "frozen", ySplit: 1 }];
  usersSheet.getRow(1).font = { bold: true };

  const exampleSheet = workbook.addWorksheet("Example");
  exampleSheet.addRow(["name", "email", "password", "role"]);
  exampleSheet.addRow(["Example Student", "student@example.invalid", "", "student"]);
  exampleSheet.addRow([
    "Fill in the Users sheet; replace the example values and set a unique password.",
  ]);
  exampleSheet.getRow(1).font = { bold: true };
  exampleSheet.getColumn(1).width = 28;
  exampleSheet.getColumn(2).width = 32;
  exampleSheet.getColumn(3).width = 32;
  exampleSheet.getColumn(4).width = 16;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { parseWorkbookRows, createUserImportTemplate };
