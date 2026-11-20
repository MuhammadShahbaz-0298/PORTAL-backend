// HTTP routes for e xp or t.
// Applies authentication and permissions before controllers run.
// Routes for Excel exports. Same permission checks as underlying list endpoints.

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
router.get("/attendance/export", requirePermission("attendance.export"), exportAttendance);
router.get("/submissions/export", requirePermission("submissions.export"), exportSubmissions);

module.exports = router;
