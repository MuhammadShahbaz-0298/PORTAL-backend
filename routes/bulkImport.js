// Routes for bulk CSV import.

const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { bulkImportUsers, bulkEnroll } = require("../controllers/bulkImportController");

const upload = multer({ dest: "uploads/" });

const router = express.Router();

router.use(auth);
router.post(
  "/users/bulk-import",
  requirePermission("users.manage"),
  upload.single("file"),
  bulkImportUsers,
);
router.post(
  "/batches/:id/bulk-enroll",
  requirePermission("batches.enroll"),
  upload.single("file"),
  bulkEnroll,
);

module.exports = router;
