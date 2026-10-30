// Routes for submissions. Students upload only their own work; teachers grade their own batches.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const requireRole = require("../middleware/requireRole");
const requireOwnSubmission = require("../middleware/requireOwnBatch");
const uploadZip = require("../middleware/uploadZip");
const {
  createSubmission,
  updateSubmission,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
} = require("../controllers/submissionController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("submissions.view"), getSubmissions);
router.post(
  "/",
  requirePermission("submissions.view"),
  requireRole("student"),
  uploadZip.single("file"),
  createSubmission,
);
router.patch(
  "/:id/file",
  requirePermission("submissions.view"),
  requireRole("student"),
  uploadZip.single("file"),
  updateSubmission,
);
router.get("/:id/download", requirePermission("submissions.view"), downloadSubmission);
router.patch(
  "/:id/grade",
  requirePermission("submissions.grade"),
  requireOwnSubmission,
  gradeSubmission,
);

module.exports = router;
