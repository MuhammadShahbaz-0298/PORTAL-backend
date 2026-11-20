// Store and resolve assignment resource files outside public folders.
// Only sanitized display names are exposed; disk names are random identifiers.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STORAGE_DIR =
  process.env.ASSIGNMENT_RESOURCE_DIR ||
  path.join(__dirname, "..", "uploads", "assignment-resources");
const MAX_RESOURCE_SIZE_BYTES =
  Number(process.env.MAX_ASSIGNMENT_RESOURCE_MB) * 1024 * 1024 || 50 * 1024 * 1024;
const ALLOWED_RESOURCE_EXTENSIONS = process.env.ALLOWED_RESOURCE_EXTENSIONS
  ? process.env.ALLOWED_RESOURCE_EXTENSIONS.split(",")
  : [".pdf", ".doc", ".docx", ".txt", ".zip"];
const MAX_FILE_NAME_LENGTH = 200;
const FORBIDDEN_FILE_NAME_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);

function getStorageDir() {
  const configured = process.env.ASSIGNMENT_RESOURCE_DIR;
  return configured ? path.resolve(configured) : path.resolve(STORAGE_DIR);
}

async function ensureStorageDir() {
  await fs.promises.mkdir(getStorageDir(), { recursive: true });
}

function sanitizeOriginalName(originalName, extension) {
  const base = path.basename(String(originalName || "resource"));
  const withoutExtension = base.toLowerCase().endsWith(extension)
    ? base.slice(0, base.length - extension.length)
    : base;
  const cleaned =
    Array.from(withoutExtension)
      .map((character) =>
        character.charCodeAt(0) < 32 || FORBIDDEN_FILE_NAME_CHARACTERS.has(character)
          ? "_"
          : character,
      )
      .join("")
      .trim() || "resource";
  return `${cleaned.slice(0, MAX_FILE_NAME_LENGTH)}${extension}`;
}

function toPublicResource(resource) {
  return {
    _id: resource._id,
    fileName: resource.fileName,
    uploadedAt: resource.uploadedAt,
  };
}

async function storeResourceFile(file, extension) {
  await ensureStorageDir();
  const storedName = `${crypto.randomUUID()}${extension}`;
  const destination = path.join(getStorageDir(), storedName);
  await fs.promises.rename(file.path, destination);
  return { storedName, destination };
}

function resolveResourceFile(filePath) {
  return path.join(getStorageDir(), path.basename(filePath));
}

async function removeFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

module.exports = {
  MAX_RESOURCE_SIZE_BYTES,
  ALLOWED_RESOURCE_EXTENSIONS,
  getStorageDir,
  sanitizeOriginalName,
  toPublicResource,
  storeResourceFile,
  resolveResourceFile,
  removeFile,
};
