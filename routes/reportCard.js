// Routes for report card PDF export.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { getReportCard } = require("../controllers/reportCardController");

const router = express.Router();

router.use(auth);
router.get("/:id/report-card", requirePermission("profile.view"), getReportCard);

module.exports = router;
