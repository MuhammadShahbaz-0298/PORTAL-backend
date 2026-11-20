// HTTP routes for b ul ki mp or t.
// Applies authentication and permissions before controllers run.
// Routes for bulk Excel import.

const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  bulkImportUsers,
  bulkEnroll,
  downloadUserImportTemplate,
} = require("../controllers/bulkImportController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();

router.use(auth);
router.get(
  "/users/bulk-import/template",
  requirePermission("users.manage"),
  downloadUserImportTemplate,
);
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
