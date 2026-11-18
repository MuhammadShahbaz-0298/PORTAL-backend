// Routes for weighted grade computation. Read-only.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { getWeightedScore } = require("../controllers/weightedGradeController");

const router = express.Router();

router.use(auth);
router.get("/:studentId", requirePermission("students.view"), getWeightedScore);

module.exports = router;
