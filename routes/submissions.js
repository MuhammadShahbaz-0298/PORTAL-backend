const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const uploadZip = require("../middleware/uploadZip");
const {
  createSubmission,
  updateSubmission,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
} = require("../controllers/submissionController");

router.use(auth);
router.get("/", getSubmissions);
router.post(
  "/",
  requireRole("student"),
  uploadZip.single("file"),
  createSubmission,
);
router.patch(
  "/:id/file",
  requireRole("student"),
  uploadZip.single("file"),
  updateSubmission,
);
router.get("/:id/download", downloadSubmission);
router.patch("/:id/grade", requireRole("teacher", "admin"), gradeSubmission);

module.exports = router;
