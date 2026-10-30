// ZIP upload handling.
// The stored file name is random, so a user's file name can never become a path.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { AppError } = require("../utils/errors");
const { getUploadRoot } = require("../utils/files");
const {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  GLOBAL_UPLOAD_MAX_BYTES,
} = require("../constants");

const storage = multer.diskStorage({
  destination: (request, file, callback) => {
    const uploadRoot = getUploadRoot();
    fs.mkdirSync(uploadRoot, { recursive: true });
    callback(null, uploadRoot);
  },
  filename: (request, file, callback) => {
    callback(null, `${crypto.randomUUID()}.zip`);
  },
});

function fileFilter(request, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype);

  if (hasAllowedExtension && hasAllowedMimeType) {
    return callback(null, true);
  }

  return callback(new AppError("Only .zip files are allowed.", 400));
}

const uploadZip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: GLOBAL_UPLOAD_MAX_BYTES,
    files: 1,
  },
});

module.exports = uploadZip;
