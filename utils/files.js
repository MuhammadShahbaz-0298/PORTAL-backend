// All upload file handling lives here.
// Files are stored outside any public folder and are read only through an authorized route.

const fs = require("fs/promises");
const path = require("path");
const { AppError } = require("./errors");

const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

function getUploadRoot() {
  const configuredDirectory = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
  return path.resolve(configuredDirectory);
}

async function isZipFile(filePath) {
  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    return ZIP_SIGNATURES.some((signature) => buffer.equals(signature));
  } finally {
    await handle.close();
  }
}

async function removeFile(filePath) {
  if (!filePath) {
    return;
  }

  await fs.unlink(filePath).catch(() => undefined);
}

// Convert a stored name into an absolute path, and refuse anything outside the upload folder.
function resolveUploadPath(storedPath) {
  const uploadRoot = getUploadRoot();
  const candidatePath = path.isAbsolute(storedPath)
    ? path.resolve(storedPath)
    : path.resolve(uploadRoot, storedPath);
  const relativePath = path.relative(uploadRoot, candidatePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new AppError("Invalid file path.", 400);
  }

  return candidatePath;
}

// The original file name is shown to users, but it is never trusted as a path.
function sanitizeDisplayFileName(originalName) {
  const baseName = path.basename(String(originalName || ""));
  const cleanedName = baseName.replace(/[^\w.\- ]+/g, "_").slice(0, 255);
  return cleanedName || "submission.zip";
}

module.exports = {
  getUploadRoot,
  isZipFile,
  removeFile,
  resolveUploadPath,
  sanitizeDisplayFileName,
};
