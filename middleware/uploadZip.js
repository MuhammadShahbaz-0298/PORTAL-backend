const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${req.user.userId}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const isZipExt =
    path.extname(file.originalname).toLowerCase() === '.zip';

  const isZipMime = [
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
  ].includes(file.mimetype);

  if (isZipExt && isZipMime) {
    return cb(null, true);
  }

  cb(new Error('Only .zip files are allowed'));
};

const uploadZip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

module.exports = uploadZip;
