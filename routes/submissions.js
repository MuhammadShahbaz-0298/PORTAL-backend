// Routes for submissions. Students upload only their own work; teachers grade their own batches.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const requireRole = require("../middleware/requireRole");
const requireOwnSubmission = require("../middleware/requireOwnBatch");
const { ROLES } = require("../constants");
const uploadZip = require("../middleware/uploadZip");
const {
  createSubmission,
  updateSubmission,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
  regenerateAiDraft,
  discardAiDraft,
  getVersions,
} = require("../controllers/submissionController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("submissions.view"), getSubmissions);
router.post(
  "/",
  requirePermission("submissions.view"),
  requireRole(ROLES.STUDENT),
  uploadZip.single("file"),
  createSubmission,
);
router.patch(
  "/:id/file",
  requirePermission("submissions.view"),
  requireRole(ROLES.STUDENT),
  uploadZip.single("file"),
  updateSubmission,
);
router.get("/:id/download", requirePermission("submissions.view"), downloadSubmission);
router.get("/:id/versions", requirePermission("submissions.view"), getVersions);
router.patch(
  "/:id/grade",
  requirePermission("submissions.grade"),
  requireOwnSubmission,
  gradeSubmission,
);
router.post(
  "/:id/ai-draft",
  requirePermission("submissions.grade"),
  requireOwnSubmission,
  regenerateAiDraft,
);
router.patch(
  "/:id/ai-draft/discard",
  requirePermission("submissions.grade"),
  requireOwnSubmission,
  discardAiDraft,
);

module.exports = router;
