// Routes for CSV exports. Same permission checks as underlying list endpoints.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  exportUsers,
  exportAttendance,
  exportSubmissions,
} = require("../controllers/exportController");

const router = express.Router();

router.use(auth);
router.get("/users/export", requirePermission("users.manage"), exportUsers);
router.get("/attendance/export", requirePermission("attendance.view"), exportAttendance);
router.get("/submissions/export", requirePermission("submissions.view"), exportSubmissions);

module.exports = router;
