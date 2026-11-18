// Routes for GDPR export and deletion request.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { exportData, requestDeletion } = require("../controllers/gdprController");

const router = express.Router();

router.use(auth);
router.get("/:id/export-data", requirePermission("profile.view"), exportData);
router.post("/:id/request-deletion", requirePermission("profile.view"), requestDeletion);

module.exports = router;
